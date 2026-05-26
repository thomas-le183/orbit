import { Logger } from "@nestjs/common";
import type { SubscriptionPlan } from "@orbit/shared";
import type { Queue } from "bullmq";
import { count, eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
	getPlanLookupKey,
	getStripePriceByLookupKey,
	inferBillingIntervalFromStripeSubscription,
	normalizeBillingInterval,
	PLAN_LOOKUP_KEYS,
	resolveSubscriptionItemByLookupKey,
	resolveSubscriptionItemByPrice,
	type StripeClientForSeatBilling,
	type StripeProrationBehavior,
} from "../billing/stripe-seat-billing";
import type { Db } from "../db/db.module";
import * as schema from "../db/schema";

const seatBillingLogger = new Logger("PerSeatBilling");

function isPaidPlan(
	plan: string,
): plan is Extract<SubscriptionPlan, "basic" | "business"> {
	return plan === "basic" || plan === "business";
}

async function getMemberCount(db: Db, organizationId: string): Promise<number> {
	const result = await db
		.select({ value: count() })
		.from(schema.member)
		.where(eq(schema.member.organizationId, organizationId));
	return result[0]?.value ?? 0;
}

export async function syncStripeSeatQuantity({
	db,
	stripeClient,
	organizationId,
	prorationBehavior,
}: {
	db: Db;
	stripeClient: StripeClientForSeatBilling;
	organizationId: string;
	prorationBehavior: StripeProrationBehavior;
}) {
	try {
		const subscription = await db.query.subscription.findFirst({
			where: eq(schema.subscription.referenceId, organizationId),
		});

		if (
			!subscription ||
			!isPaidPlan(subscription.plan) ||
			!subscription.stripeSubscriptionId
		) {
			return;
		}

		const [memberCount, stripeSubscription] = await Promise.all([
			getMemberCount(db, organizationId),
			stripeClient.subscriptions.retrieve(subscription.stripeSubscriptionId),
		]);
		const billingInterval =
			normalizeBillingInterval(subscription.billingInterval) ??
			inferBillingIntervalFromStripeSubscription(
				stripeSubscription,
				subscription.plan,
			);
		const lookupKey = getPlanLookupKey(subscription.plan, billingInterval);
		if (!lookupKey) return;

		const price = await getStripePriceByLookupKey(stripeClient, lookupKey);
		const subscriptionItem = price
			? resolveSubscriptionItemByPrice(stripeSubscription, price)
			: resolveSubscriptionItemByLookupKey(stripeSubscription, lookupKey);

		if (!subscriptionItem) {
			seatBillingLogger.warn(
				`Could not find Stripe subscription item for ${lookupKey} on ${subscription.stripeSubscriptionId}`,
			);
			return;
		}

		if (subscriptionItem.quantity === memberCount) return;

		await stripeClient.subscriptions.update(subscription.stripeSubscriptionId, {
			items: [{ id: subscriptionItem.id, quantity: memberCount }],
			proration_behavior: prorationBehavior,
		});
	} catch (error) {
		seatBillingLogger.error(
			"Failed to sync Stripe seat quantity",
			error instanceof Error ? error.stack : undefined,
		);
	}
}

export async function autoStartTrial(
	orgId: string,
	db: Db,
	stripeClient: Stripe,
): Promise<void> {
	try {
		// Idempotency: skip if trial already exists
		const existing = await db.query.subscription.findFirst({
			where: eq(schema.subscription.referenceId, orgId),
		});
		if (existing) return;

		const org = await db.query.organization.findFirst({
			where: eq(schema.organization.id, orgId),
		});
		if (!org) return;

		// Create or reuse Stripe customer
		let customerId = org.stripeCustomerId ?? null;
		if (!customerId) {
			const customer = await stripeClient.customers.create({
				name: org.name,
				metadata: { referenceId: orgId, referenceType: "organization" },
			});
			customerId = customer.id;
			await db
				.update(schema.organization)
				.set({ stripeCustomerId: customerId })
				.where(eq(schema.organization.id, orgId));
		}

		// Resolve Business monthly price
		const price = await getStripePriceByLookupKey(
			stripeClient as StripeClientForSeatBilling,
			PLAN_LOOKUP_KEYS.business!.monthly,
		);
		if (!price) {
			seatBillingLogger.error(
				`Business monthly price not found; cannot auto-start trial for org ${orgId}`,
			);
			return;
		}

		// Create trialing Stripe subscription
		const trialEndUnix = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
		const stripeSub = await stripeClient.subscriptions.create({
			customer: customerId,
			items: [{ price: price.id, quantity: 1 }],
			trial_end: trialEndUnix,
			payment_settings: { payment_method_collection: "if_required" },
			metadata: { referenceId: orgId, referenceType: "organization" },
		});

		// Insert subscription row
		const now = new Date();
		const periodEnd = new Date(trialEndUnix * 1000);
		await db.insert(schema.subscription).values({
			plan: "business",
			referenceId: orgId,
			stripeCustomerId: customerId,
			stripeSubscriptionId: stripeSub.id,
			status: "trialing",
			periodStart: now,
			periodEnd,
			trialStart: now,
			trialEnd: periodEnd,
			seats: 1,
			billingInterval: "monthly",
			cancelAtPeriodEnd: false,
		});
	} catch (error) {
		seatBillingLogger.error(
			`autoStartTrial failed for org ${orgId}`,
			error instanceof Error ? error.stack : undefined,
		);
	}
}

export function createOrganizationHooks({
	db,
	emailQueue,
	notificationQueue,
	appUrl,
	stripeClient,
}: {
	db: Db;
	emailQueue: Queue;
	notificationQueue: Queue;
	appUrl: string;
	stripeClient: Stripe;
}) {
	return {
		afterCreateOrganization: async ({ organization: org, user: owner }) => {
			void emailQueue.add("send-workspace-created", {
				type: "send-workspace-created",
				to: owner.email,
				data: {
					ownerName: owner.name,
					organizationName: org.name,
					workspaceUrl: `${appUrl}/${org.slug}`,
				},
			});

			void autoStartTrial(org.id, db, stripeClient);
		},

		afterAcceptInvitation: async ({
			invitation,
			user: newMember,
			organization: org,
		}) => {
			// better-auth wrote the new member row directly — invalidate our cache manually
			void db.$cache?.invalidate({ tags: [`member-count:${org.id}`] });

			const inviter = await db.query.user.findFirst({
				where: eq(schema.user.id, invitation.inviterId),
			});
			if (inviter) {
				void emailQueue.add("send-member-joined", {
					type: "send-member-joined",
					to: inviter.email,
					data: {
						newMemberName: newMember.name,
						newMemberEmail: newMember.email,
						organizationName: org.name,
						workspaceUrl: `${appUrl}/${org.slug}`,
					},
				});

				void notificationQueue.add("member_joined", {
					type: "member_joined",
					recipientId: inviter.id,
					actorName: newMember.name,
					orgName: org.name,
					orgSlug: org.slug,
				});
			}

			await syncStripeSeatQuantity({
				db,
				stripeClient,
				organizationId: org.id,
				prorationBehavior: "always_invoice",
			});
		},

		afterCreateInvitation: async () => {},
		afterCancelInvitation: async () => {},
		afterRejectInvitation: async () => {},
		afterUpdateOrganization: async () => {},
		afterDeleteOrganization: async () => {},
		// afterCreateTeam: async () => {},
		// afterUpdateTeam: async () => {},
		// afterDeleteTeam: async () => {},
		afterAddMember: async () => {},
		afterUpdateMemberRole: async () => {},
		afterRemoveMember: async ({ organization: org }) => {
			void db.$cache?.invalidate({ tags: [`member-count:${org.id}`] });

			await syncStripeSeatQuantity({
				db,
				stripeClient,
				organizationId: org.id,
				prorationBehavior: "create_prorations",
			});
		},
		afterAddTeamMember: async () => {},
		afterRemoveTeamMember: async () => {},
	};
}
