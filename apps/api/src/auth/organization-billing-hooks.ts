import { Logger } from "@nestjs/common";
import type { SubscriptionPlan } from "@orbit/shared";
import { count, eq } from "drizzle-orm";
import {
	getPlanLookupKey,
	getStripePriceByLookupKey,
	inferBillingIntervalFromStripeSubscription,
	normalizeBillingInterval,
	resolveSubscriptionItemByLookupKey,
	resolveSubscriptionItemByPrice,
	type StripeClientForSeatBilling,
	type StripeProrationBehavior,
} from "../billing/stripe-seat-billing";
import type { Db } from "../db/db.module";
import * as schema from "../db/schema";
import type { EmailService } from "../email/email.service";

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

export function createOrganizationHooks({
	db,
	email,
	appUrl,
	stripeClient,
}: {
	db: Db;
	email: EmailService;
	appUrl: string;
	stripeClient: StripeClientForSeatBilling;
}) {
	return {
		afterCreateOrganization: async ({ organization: org, user: owner }) => {
			void email.sendWorkspaceCreated(owner.email, {
				ownerName: owner.name,
				organizationName: org.name,
				workspaceUrl: `${appUrl}/${org.slug}`,
			});
		},

		afterAcceptInvitation: async ({
			invitation,
			user: newMember,
			organization: org,
		}) => {
			const inviter = await db.query.user.findFirst({
				where: eq(schema.user.id, invitation.inviterId),
			});
			if (inviter) {
				void email.sendMemberJoined(inviter.email, {
					newMemberName: newMember.name,
					newMemberEmail: newMember.email,
					organizationName: org.name,
					workspaceUrl: `${appUrl}/${org.slug}`,
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
