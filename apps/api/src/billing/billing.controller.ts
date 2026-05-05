import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
import type {
	CheckoutResponse,
	PlanResponse,
	PortalResponse,
	SubscriptionPlan,
	SubscriptionResponse,
} from "@orbit/shared";
import { PLAN_METADATA } from "@orbit/shared";
import type { User } from "../auth/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

@Controller("billing")
export class BillingController {
	constructor(
		private readonly billingService: BillingService,
		private readonly stripeService: StripeService,
	) {}

	@Get("plans")
	async getPlans(): Promise<PlanResponse[]> {
		return this.billingService.getPlans();
	}

	@Get(":orgSlug/subscription")
	async getSubscription(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
	): Promise<SubscriptionResponse> {
		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		await this.requireMember(user.id, org.id);

		const plan = await this.billingService.getOrgSubscriptionPlan(org.id);
		const subscription = await this.billingService.getSubscription(org.id);
		const memberCount = await this.billingService.getMemberCount(org.id);
		const metadata = PLAN_METADATA[plan];
		const trialEligible = await this.billingService.isTrialEligible(org.id);

		return {
			plan,
			planLabel: metadata.label,
			trialEligible,
			usage: {
				members: {
					current: memberCount,
					limit: metadata.memberLimit,
				},
			},
			subscription: subscription
				? {
						status: subscription.status,
						currentPeriodStart: subscription.currentPeriodStart,
						currentPeriodEnd: subscription.currentPeriodEnd,
						cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
					}
				: null,
		};
	}

	@Post(":orgSlug/checkout")
	async createCheckout(
		@Param("orgSlug") orgSlug: string,
		@Body() body: { plan: SubscriptionPlan; interval: "monthly" | "yearly" },
		@CurrentUser() user: User,
	): Promise<CheckoutResponse> {
		const { plan, interval } = body;
		if (plan === "free" || plan === "enterprise") {
			throw new BadRequestException("Cannot checkout for this plan");
		}

		const lookupKey = this.billingService.getLookupKeyForPlan(plan, interval);
		if (!lookupKey) {
			throw new BadRequestException("Invalid plan or interval");
		}

		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		await this.requireAdminOrOwner(user.id, org.id);

		const existingSub = await this.billingService.getSubscription(org.id);
		if (
			existingSub &&
			["active", "trialing", "past_due"].includes(existingSub.status)
		) {
			throw new BadRequestException(
				"Organization already has an active subscription. Use change-plan instead.",
			);
		}

		const seatCount = await this.billingService.getMemberCount(org.id);

		let billing = await this.billingService.getBillingRecord(org.id);
		if (!billing) {
			const customer = await this.stripeService.createCustomer(
				org.id,
				org.name,
				user.email,
			);
			billing = await this.billingService.getOrCreateBillingRecord(
				org.id,
				customer.id,
			);
		}

		const trialEligible = await this.billingService.isTrialEligible(org.id);
		const trialDays = plan === "business" && trialEligible ? 30 : undefined;

		const session = await this.stripeService.createCheckoutSession(
			billing.stripeCustomerId,
			lookupKey,
			seatCount,
			orgSlug,
			org.id,
			trialDays,
		);

		return { url: session.url };
	}

	@Post(":orgSlug/change-plan")
	async changePlan(
		@Param("orgSlug") orgSlug: string,
		@Body() body: {
			plan: SubscriptionPlan;
			interval: "monthly" | "yearly";
			endTrial?: boolean;
		},
		@CurrentUser() user: User,
	): Promise<{ success: boolean; url?: string } | { url: string }> {
		const { plan, interval, endTrial } = body;
		if (plan === "free" || plan === "enterprise") {
			throw new BadRequestException(
				"Cannot change to this plan via this endpoint",
			);
		}

		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		await this.requireAdminOrOwner(user.id, org.id);

		return this.billingService.changeOrgSubscriptionPlan(
			org.id,
			plan,
			interval,
			endTrial,
			orgSlug,
		);
	}

	@Post(":orgSlug/cancel")
	async cancelSubscription(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
	): Promise<{ success: boolean }> {
		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		await this.requireAdminOrOwner(user.id, org.id);

		const sub = await this.billingService.getSubscription(org.id);
		if (!sub?.stripeSubscriptionId) {
			throw new BadRequestException("No active subscription to cancel");
		}
		if (sub.cancelAtPeriodEnd || sub.status === "canceled") {
			throw new BadRequestException(
				"Subscription is already canceled or canceling",
			);
		}

		await this.stripeService.cancelSubscriptionAtPeriodEnd(
			sub.stripeSubscriptionId,
		);
		return { success: true };
	}

	@Post(":orgSlug/start-trial")
	async startTrial(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
	): Promise<{ status: string }> {
		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		await this.requireAdminOrOwner(user.id, org.id);

		await this.billingService.startTrial(org.id, org.name, user.email);
		return { status: "trialing" };
	}

	@Post(":orgSlug/portal")
	async createPortal(
		@Param("orgSlug") orgSlug: string,
		@CurrentUser() user: User,
	): Promise<PortalResponse> {
		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		await this.requireAdminOrOwner(user.id, org.id);

		const billing = await this.billingService.getBillingRecord(org.id);
		if (!billing) {
			throw new BadRequestException(
				"No billing record found. Subscribe to a plan first.",
			);
		}

		const session = await this.stripeService.createPortalSession(
			billing.stripeCustomerId,
			orgSlug,
		);

		return { url: session.url };
	}

	private async requireMember(userId: string, orgId: string) {
		const member = await this.billingService.getOrgMember(userId, orgId);
		if (!member)
			throw new ForbiddenException("You are not a member of this organization");
		return member;
	}

	private async requireAdminOrOwner(userId: string, orgId: string) {
		const member = await this.requireMember(userId, orgId);
		if (member.role !== "owner" && member.role !== "admin") {
			throw new ForbiddenException("Only admins and owners can manage billing");
		}
	}
}
