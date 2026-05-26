import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Inject,
	NotFoundException,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { PlanResponse, SubscriptionResponse } from "@orbit/shared";
import { PLAN_METADATA } from "@orbit/shared";
import { eq } from "drizzle-orm";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(AuthGuard)
export class BillingController {
	constructor(
		private readonly billingService: BillingService,
		@Inject(DB) private readonly db: Db,
	) {}

	@Get("plans")
	async getPlans(): Promise<PlanResponse[]> {
		return this.billingService.getPlans();
	}

	@Post(":orgSlug/cancel")
	async cancelSubscription(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
	): Promise<void> {
		const org = await this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, orgSlug),
		});
		if (!org) throw new NotFoundException("Organization not found");

		const member = await this.billingService.getOrgMember(user.id, org.id);
		if (!member)
			throw new ForbiddenException("You are not a member of this organization");

		return this.billingService.cancelAtPeriodEnd(org.id);
	}

	@Post(":orgSlug/activate-trial")
	async activateTrial(
		@Param("orgSlug") orgSlug: string,
		@Body() body: { successUrl: string; cancelUrl: string },
		@CurrentUser() user: User,
	): Promise<{ url: string }> {
		const org = await this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, orgSlug),
		});
		if (!org) throw new NotFoundException("Organization not found");

		const member = await this.billingService.getOrgMember(user.id, org.id);
		if (!member)
			throw new ForbiddenException("You are not a member of this organization");

		return this.billingService.activateTrial(
			org.id,
			body.successUrl,
			body.cancelUrl,
		);
	}

	@Get(":orgSlug/subscription")
	async getSubscription(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
	): Promise<SubscriptionResponse> {
		const org = await this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, orgSlug),
		});
		if (!org) throw new NotFoundException("Organization not found");

		const member = await this.billingService.getOrgMember(user.id, org.id);
		if (!member)
			throw new ForbiddenException("You are not a member of this organization");

		const plan = await this.billingService.getOrgSubscriptionPlan(org.id);
		const subscription = await this.billingService.getSubscription(org.id);
		const memberCount = await this.billingService.getMemberCount(org.id);
		const metadata = PLAN_METADATA[plan];
		const trialEligible = await this.billingService.isTrialEligible(org.id);
		const hasSeatBilling = plan === "basic" || plan === "business";
		const billingInterval = hasSeatBilling
			? await this.billingService.getSubscriptionBillingInterval(subscription)
			: null;
		const pricePerSeat = hasSeatBilling
			? await this.billingService.getPricePerSeat(plan, billingInterval)
			: null;

		return {
			plan,
			planLabel: metadata.label,
			trialEligible,
			pricePerSeat,
			billingInterval,
			usage: {
				members: {
					current: memberCount,
					limit: metadata.memberLimit,
				},
			},
			subscription: subscription
				? {
						status: subscription.status,
						currentPeriodStart: subscription.periodStart ?? new Date(),
						currentPeriodEnd: subscription.periodEnd ?? new Date(),
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
						plan: subscription.plan as import("@orbit/shared").SubscriptionPlan,
						wasTrial: subscription.trialStart != null,
					}
				: null,
		};
	}
}
