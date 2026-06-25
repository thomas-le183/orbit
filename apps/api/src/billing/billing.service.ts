import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	type BillingInterval,
	PLAN_METADATA,
	type PlanResponse,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { and, count, eq } from "drizzle-orm";
import Stripe from "stripe";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import {
	getPlanLookupKey,
	getStripePriceByLookupKey,
	inferBillingIntervalFromStripeSubscription,
	normalizeBillingInterval,
	PLAN_LOOKUP_KEYS,
} from "./stripe-seat-billing";

@Injectable()
export class BillingService {
	private readonly stripe: InstanceType<typeof Stripe>;

	constructor(
		@Inject(DB) private readonly db: Db,
		config: ConfigService,
	) {
		this.stripe = new Stripe(config.getOrThrow<string>("STRIPE_SECRET_KEY"));
	}

	async getSubscription(organizationId: string) {
		return this.db.query.subscription.findFirst({
			where: eq(schema.subscription.referenceId, organizationId),
		});
	}

	async getOrgSubscriptionPlan(
		organizationId: string,
	): Promise<SubscriptionPlan> {
		const sub = await this.getSubscription(organizationId);
		if (
			!sub ||
			sub.status === "unpaid" ||
			sub.status === "incomplete_expired" ||
			sub.status === "past_due"
		) {
			return "free";
		}
		if (
			sub.status === "canceled" &&
			sub.periodEnd &&
			sub.periodEnd <= new Date()
		) {
			return "free";
		}
		return (sub.plan as SubscriptionPlan) ?? "free";
	}

	async getMemberCount(organizationId: string): Promise<number> {
		const result = await this.db
			.select({ value: count() })
			.from(schema.member)
			.where(eq(schema.member.organizationId, organizationId))
			.$withCache({ tag: `member-count:${organizationId}`, config: { ex: 300 } });
		return result[0]?.value ?? 0;
	}

	async getOrgMember(userId: string, organizationId: string) {
		return this.db.query.member.findFirst({
			where: and(
				eq(schema.member.userId, userId),
				eq(schema.member.organizationId, organizationId),
			),
		});
	}

	async getSubscriptionBillingInterval(
		subscription: typeof schema.subscription.$inferSelect | null | undefined,
	): Promise<BillingInterval | null> {
		if (!subscription) return null;

		const storedInterval = normalizeBillingInterval(
			subscription.billingInterval,
		);
		if (storedInterval) return storedInterval;
		if (!subscription.stripeSubscriptionId) return null;

		const stripeSubscription = await this.stripe.subscriptions.retrieve(
			subscription.stripeSubscriptionId,
		);
		return inferBillingIntervalFromStripeSubscription(
			stripeSubscription,
			subscription.plan as SubscriptionPlan,
		);
	}

	async getPricePerSeat(
		plan: SubscriptionPlan,
		billingInterval: BillingInterval | null,
	): Promise<number | null> {
		const lookupKey = getPlanLookupKey(plan, billingInterval);
		if (!lookupKey) return null;

		const price = await getStripePriceByLookupKey(this.stripe, lookupKey);
		return price?.unit_amount != null ? price.unit_amount / 100 : null;
	}

	async createTrialConversionCheckout(
		organizationId: string,
		successUrl: string,
		cancelUrl: string,
	): Promise<{ url: string }> {
		const sub = await this.db.query.subscription.findFirst({
			where: eq(schema.subscription.referenceId, organizationId),
		});

		if (!sub || sub.status !== "trialing") {
			throw new BadRequestException("No active trial found for this organization");
		}
		if (!sub.stripeCustomerId) {
			throw new BadRequestException("No Stripe customer found");
		}

		const session = await this.stripe.checkout.sessions.create({
			mode: "setup",
			customer: sub.stripeCustomerId,
			metadata: {
				organization_id: organizationId,
			},
			setup_intent_data: {
				metadata: {
					subscription_id: sub.stripeSubscriptionId ?? "",
					organization_id: organizationId,
				},
			},
			success_url: successUrl,
			cancel_url: cancelUrl,
		});

		if (!session.url) throw new BadRequestException("Could not create checkout session");
		return { url: session.url };
	}

	async activateTrialConversion(
		organizationId: string,
		checkoutSessionId: string,
	): Promise<void> {
		const sub = await this.db.query.subscription.findFirst({
			where: eq(schema.subscription.referenceId, organizationId),
		});

		if (!sub || sub.status !== "trialing") {
			throw new BadRequestException("No active trial found for this organization");
		}
		if (!sub.stripeSubscriptionId) {
			throw new BadRequestException("No Stripe subscription found");
		}

		const session = await this.stripe.checkout.sessions.retrieve(
			checkoutSessionId,
			{ expand: ["setup_intent"] },
		);

		if (session.mode !== "setup" || session.status !== "complete") {
			throw new BadRequestException("Checkout session not completed");
		}
		if (session.metadata?.organization_id !== organizationId) {
			throw new BadRequestException("Checkout session does not belong to this organization");
		}
		if (session.customer !== sub.stripeCustomerId) {
			throw new BadRequestException("Checkout session customer mismatch");
		}

		const setupIntent = session.setup_intent as { payment_method: string | { id: string } | null } | null;
		if (!setupIntent?.payment_method) {
			throw new BadRequestException("No payment method found in session");
		}

		const paymentMethodId =
			typeof setupIntent.payment_method === "string"
				? setupIntent.payment_method
				: setupIntent.payment_method.id;

		await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
			default_payment_method: paymentMethodId,
		});
	}

	async cancelAtPeriodEnd(organizationId: string): Promise<void> {
		const sub = await this.db.query.subscription.findFirst({
			where: eq(schema.subscription.referenceId, organizationId),
		});

		if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) {
			throw new BadRequestException(
				"No active subscription found for this organization",
			);
		}

		if (!sub.stripeSubscriptionId) {
			throw new NotFoundException("Stripe subscription not found");
		}

		// Set cancel_at_period_end on Stripe — the webhook handler (better-auth) will
		// sync cancelAtPeriodEnd and status back to the DB.
		await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
			cancel_at_period_end: true,
		});
	}


	async getPlans(): Promise<PlanResponse[]> {
		const allLookupKeys = Object.values(PLAN_LOOKUP_KEYS).flatMap((keys) => [
			keys.monthly,
			keys.yearly,
		]);
		const prices = await this.stripe.prices.list({
			lookup_keys: allLookupKeys,
			limit: allLookupKeys.length,
		});
		const priceMap = Object.fromEntries(
			prices.data.map((p) => [p.lookup_key, p.unit_amount]),
		) as Record<string, number | null>;

		return (
			Object.keys(SUBSCRIPTION_PLANS) as Array<keyof typeof SUBSCRIPTION_PLANS>
		)
			.map((key) => SUBSCRIPTION_PLANS[key])
			.map((plan) => {
				const meta = PLAN_METADATA[plan];
				const keys = PLAN_LOOKUP_KEYS[plan];
				const isEnterprise = plan === SUBSCRIPTION_PLANS.ENTERPRISE;
				const monthlyAmount = keys ? priceMap[keys.monthly] : null;
				const yearlyAmount = keys ? priceMap[keys.yearly] : null;
				return {
					id: plan,
					label: meta.label,
					description: meta.description,
					features: meta.features,
					flags: meta.flags,
					isEnterprise,
					price: {
						monthly: monthlyAmount != null ? monthlyAmount / 100 : null,
						yearly: yearlyAmount != null ? yearlyAmount / 100 : null,
					},
				};
			});
	}
}
