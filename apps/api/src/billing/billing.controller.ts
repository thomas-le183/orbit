import {
	BadRequestException,
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type {
	CheckoutResponse,
	PlanResponse,
	PortalResponse,
	SubscriptionPlan,
	SubscriptionResponse,
} from "@orbit/shared";
import { PLAN_METADATA } from "@orbit/shared";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

@Controller("billing")
@UseGuards(AuthGuard)
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
	): Promise<SubscriptionResponse> {
		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

		const plan = await this.billingService.getOrgSubscriptionPlan(org.id);
		const subscription = await this.billingService.getSubscription(org.id);
		const memberCount = await this.billingService.getMemberCount(org.id);
		const metadata = PLAN_METADATA[plan];

		return {
			plan,
			planLabel: metadata.label,
			usage: {
				members: {
					current: memberCount,
					limit: metadata.memberLimit,
				},
			},
			subscription: subscription
				? {
						status: subscription.status,
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

		const session = await this.stripeService.createCheckoutSession(
			billing.stripeCustomerId,
			lookupKey,
			seatCount,
			orgSlug,
			org.id,
		);

		return { url: session.url };
	}

	@Post(":orgSlug/portal")
	async createPortal(
		@Param("orgSlug") orgSlug: string,
	): Promise<PortalResponse> {
		const org = await this.billingService.getOrgBySlug(orgSlug);
		if (!org) throw new NotFoundException("Organization not found");

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
}
