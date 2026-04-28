import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
	PLAN_METADATA,
	type PlanResponse,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { and, count, eq, isNull } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { StripeService } from "./stripe.service";

@Injectable()
export class BillingService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly stripeService: StripeService,
	) {}

	async getOrgBySlug(slug: string) {
		return this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, slug),
		});
	}

	async getBillingRecord(organizationId: string) {
		return this.db.query.organizationBilling.findFirst({
			where: eq(schema.organizationBilling.organizationId, organizationId),
		});
	}

	async getOrCreateBillingRecord(
		organizationId: string,
		stripeCustomerId: string,
	) {
		const existing = await this.getBillingRecord(organizationId);
		if (existing) return existing;

		const record = {
			id: randomUUID(),
			organizationId,
			stripeCustomerId,
			trialUsedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		await this.db.insert(schema.organizationBilling).values(record);
		return record;
	}

	async getSubscription(organizationId: string) {
		return this.db.query.subscription.findFirst({
			where: eq(schema.subscription.organizationId, organizationId),
		});
	}

	async getOrgSubscriptionPlan(
		organizationId: string,
	): Promise<SubscriptionPlan> {
		const sub = await this.getSubscription(organizationId);
		if (!sub || sub.status === "unpaid") return "free";

		// Honor paid access until the period actually ends, even after cancellation.
		if (sub.status === "canceled" && sub.currentPeriodEnd <= new Date()) {
			return "free";
		}

		return sub.subscriptionPlan as SubscriptionPlan;
	}

	async getOrgPlanBySlug(slug: string): Promise<SubscriptionPlan> {
		const org = await this.getOrgBySlug(slug);
		if (!org) return "free";
		return this.getOrgSubscriptionPlan(org.id);
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

	async canAddMember(organizationId: string): Promise<boolean> {
		const plan = await this.getOrgSubscriptionPlan(organizationId);
		const metadata = PLAN_METADATA[plan];
		if (metadata.memberLimit === -1) return true;
		const memberCount = await this.getMemberCount(organizationId);
		return memberCount < metadata.memberLimit;
	}

	async upsertSubscription(data: {
		organizationId: string;
		stripeSubscriptionId: string;
		stripePriceId: string;
		subscriptionPlan: SubscriptionPlan;
		status: string;
		currentPeriodStart: Date;
		currentPeriodEnd: Date;
		cancelAtPeriodEnd: boolean;
	}) {
		const existing = await this.getSubscription(data.organizationId);
		const now = new Date();

		if (existing) {
			await this.db
				.update(schema.subscription)
				.set({
					stripeSubscriptionId: data.stripeSubscriptionId,
					stripePriceId: data.stripePriceId,
					subscriptionPlan: data.subscriptionPlan,
					status: data.status,
					currentPeriodStart: data.currentPeriodStart,
					currentPeriodEnd: data.currentPeriodEnd,
					cancelAtPeriodEnd: data.cancelAtPeriodEnd,
					updatedAt: now,
				})
				.where(eq(schema.subscription.organizationId, data.organizationId));
		} else {
			await this.db.insert(schema.subscription).values({
				id: randomUUID(),
				...data,
				createdAt: now,
				updatedAt: now,
			});
		}

		if (data.status === "trialing") {
			await this.markTrialUsed(data.organizationId);
		}
	}

	async startTrial(
		organizationId: string,
		orgName: string,
		userEmail: string,
	): Promise<void> {
		const billing = await this.getBillingRecord(organizationId);
		if (!(await this.isTrialEligible(organizationId))) {
			throw new BadRequestException(
				"Trial has already been used for this organization",
			);
		}

		const existingSub = await this.getSubscription(organizationId);
		if (
			existingSub &&
			["active", "trialing", "past_due"].includes(existingSub.status)
		) {
			throw new BadRequestException(
				"Organization already has an active subscription",
			);
		}

		let billingRecord = billing;
		if (!billingRecord) {
			const customer = await this.stripeService.createCustomer(
				organizationId,
				orgName,
				userEmail,
			);
			billingRecord = await this.getOrCreateBillingRecord(
				organizationId,
				customer.id,
			);
		}

		const lookupKey = this.getLookupKeyForPlan("business", "monthly");
		if (!lookupKey) throw new BadRequestException("Trial plan configuration missing");

		const stripeSub = await this.stripeService.createTrialSubscription(
			billingRecord.stripeCustomerId,
			lookupKey,
			organizationId,
		);

		const item = stripeSub.items.data[0];
		await this.upsertSubscription({
			organizationId,
			stripeSubscriptionId: stripeSub.id,
			stripePriceId: item.price.id,
			subscriptionPlan: "business",
			status: stripeSub.status,
			currentPeriodStart: new Date(item.current_period_start * 1000),
			currentPeriodEnd: new Date(item.current_period_end * 1000),
			cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
		});
	}

	async findBillingByCustomerId(stripeCustomerId: string) {
		return this.db.query.organizationBilling.findFirst({
			where: eq(schema.organizationBilling.stripeCustomerId, stripeCustomerId),
		});
	}

	async isTrialEligible(organizationId: string): Promise<boolean> {
		const billing = await this.getBillingRecord(organizationId);
		return billing?.trialUsedAt == null;
	}

	async markTrialUsed(organizationId: string): Promise<void> {
		const billing = await this.getBillingRecord(organizationId);
		if (!billing) return;

		await this.db
			.update(schema.organizationBilling)
			.set({ trialUsedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(schema.organizationBilling.organizationId, organizationId),
					isNull(schema.organizationBilling.trialUsedAt),
				),
			);
	}

	async updateSubscriptionStatus(stripeSubscriptionId: string, status: string) {
		await this.db
			.update(schema.subscription)
			.set({ status, updatedAt: new Date() })
			.where(
				eq(schema.subscription.stripeSubscriptionId, stripeSubscriptionId),
			);
	}

	private readonly PLAN_TIER: Record<SubscriptionPlan, number> = {
		free: 0,
		basic: 1,
		business: 2,
		enterprise: 3,
	};

	async changeOrgSubscriptionPlan(
		organizationId: string,
		newPlan: SubscriptionPlan,
		interval: "monthly" | "yearly",
	) {
		const sub = await this.getSubscription(organizationId);
		if (!sub?.stripeSubscriptionId) throw new BadRequestException("No active subscription to change");

		const newLookupKey = this.getLookupKeyForPlan(newPlan, interval);
		if (!newLookupKey) throw new BadRequestException("Invalid plan or interval");

		const currentTier = this.PLAN_TIER[sub.subscriptionPlan as SubscriptionPlan] ?? 0;
		const newTier = this.PLAN_TIER[newPlan] ?? 0;

		await this.stripeService.changePlan(sub.stripeSubscriptionId, newLookupKey, currentTier, newTier);
	}

	async cancelSubscription(stripeSubscriptionId: string) {
		await this.db
			.update(schema.subscription)
			.set({ status: "canceled", updatedAt: new Date() })
			.where(
				eq(schema.subscription.stripeSubscriptionId, stripeSubscriptionId),
			);
	}

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

	mapLookupKeyToPlan(lookupKey: string): SubscriptionPlan {
		return this.LOOKUP_KEYS[lookupKey] ?? "free";
	}

	getLookupKeyForPlan(
		plan: SubscriptionPlan,
		interval: "monthly" | "yearly",
	): string | null {
		return this.PLAN_LOOKUP_KEYS[plan]?.[interval] ?? null;
	}

	async getPlans(): Promise<PlanResponse[]> {
		const allLookupKeys = Object.keys(this.LOOKUP_KEYS);
		const prices =
			await this.stripeService.getPricesByLookupKeys(allLookupKeys);

		return (
			Object.keys(SUBSCRIPTION_PLANS) as Array<keyof typeof SUBSCRIPTION_PLANS>
		)
			.map((key) => SUBSCRIPTION_PLANS[key])
			.map((plan) => {
				const meta = PLAN_METADATA[plan];
				const keys = this.PLAN_LOOKUP_KEYS[plan];
				const isEnterprise = plan === SUBSCRIPTION_PLANS.ENTERPRISE;
				const monthlyAmount = keys ? prices[keys.monthly] : null;
				const yearlyAmount = keys ? prices[keys.yearly] : null;
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
