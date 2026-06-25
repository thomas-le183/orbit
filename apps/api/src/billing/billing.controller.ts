import {
	BadRequestException,
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

	@Post(":orgSlug/convert-trial")
	async convertTrial(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
		@Body() body: { successUrl: string; cancelUrl: string },
	): Promise<{ url: string }> {
		if (!body.successUrl || !body.cancelUrl) {
			throw new BadRequestException("successUrl and cancelUrl are required");
		}
		const org = await this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, orgSlug),
		});
		if (!org) throw new NotFoundException("Organization not found");

		const member = await this.billingService.getOrgMember(user.id, org.id);
		if (!member)
			throw new ForbiddenException("You are not a member of this organization");
		if (member.role !== "owner" && member.role !== "admin")
			throw new ForbiddenException("Only admins can manage billing");

		return this.billingService.createTrialConversionCheckout(
			org.id,
			body.successUrl,
			body.cancelUrl,
		);
	}

	@Post(":orgSlug/activate-trial")
	async activateTrial(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
		@Body() body: { sessionId: string },
	): Promise<void> {
		if (!body.sessionId) throw new BadRequestException("sessionId is required");
		const org = await this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, orgSlug),
		});
		if (!org) throw new NotFoundException("Organization not found");

		const member = await this.billingService.getOrgMember(user.id, org.id);
		if (!member)
			throw new ForbiddenException("You are not a member of this organization");
		if (member.role !== "owner" && member.role !== "admin")
			throw new ForbiddenException("Only admins can manage billing");

		return this.billingService.activateTrialConversion(org.id, body.sessionId);
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
						periodStart: subscription.periodStart ?? new Date(),
						periodEnd: subscription.periodEnd ?? new Date(),
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
						plan: subscription.plan as import("@orbit/shared").SubscriptionPlan,
						wasTrial: subscription.trialStart != null,
						stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
						seats: subscription.seats ?? null,
					}
				: null,
		};
	}
}
