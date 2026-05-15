import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	type BillingInterval,
	PLAN_METADATA,
	type PlanResponse,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { and, count, eq, isNotNull } from "drizzle-orm";
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
			sub.status === "incomplete_expired"
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
			.where(eq(schema.member.organizationId, organizationId));
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

	async isTrialEligible(organizationId: string): Promise<boolean> {
		const sub = await this.db.query.subscription.findFirst({
			where: and(
				eq(schema.subscription.referenceId, organizationId),
				isNotNull(schema.subscription.trialStart),
			),
		});
		return sub == null;
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
