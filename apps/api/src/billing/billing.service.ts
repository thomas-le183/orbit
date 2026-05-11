import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	PLAN_METADATA,
	type PlanResponse,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { and, count, eq, isNotNull } from "drizzle-orm";
import Stripe from "stripe";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";

@Injectable()
export class BillingService {
	private readonly stripe: InstanceType<typeof Stripe>;

	private readonly LOOKUP_KEYS: Record<string, SubscriptionPlan> = {
		basic_monthly: "basic",
		basic_yearly: "basic",
		business_monthly: "business",
		business_yearly: "business",
	};

	private readonly PLAN_LOOKUP_KEYS: Partial<
		Record<SubscriptionPlan, { monthly: string; yearly: string }>
	> = {
		basic: { monthly: "basic_monthly", yearly: "basic_yearly" },
		business: { monthly: "business_monthly", yearly: "business_yearly" },
	};

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

	async getOrgSubscriptionPlan(organizationId: string): Promise<SubscriptionPlan> {
		const sub = await this.getSubscription(organizationId);
		if (!sub || sub.status === "unpaid" || sub.status === "incomplete_expired") {
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

	async getPlans(): Promise<PlanResponse[]> {
		const allLookupKeys = Object.keys(this.LOOKUP_KEYS);
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
				const keys = this.PLAN_LOOKUP_KEYS[plan];
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
