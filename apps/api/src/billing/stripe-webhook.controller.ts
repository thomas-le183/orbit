import {
	Controller,
	Headers,
	HttpCode,
	Logger,
	Post,
	RawBody,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

/** Subset of Stripe Checkout Session fields we use from the webhook payload. */
interface CheckoutSessionPayload {
	client_reference_id: string | null;
	subscription: string | { id: string } | null;
}

/** Subset of Stripe Subscription fields we use from the webhook payload. */
interface SubscriptionPayload {
	id: string;
	customer: string | { id: string };
	status: string;
	items: { data: Array<{ price: { id: string } }> };
	current_period_start: number;
	current_period_end: number;
	cancel_at_period_end: boolean;
}

/** Subset of Stripe Invoice fields we use from the webhook payload. */
interface InvoicePayload {
	subscription: string | { id: string } | null;
}

@Controller("billing/webhook")
export class StripeWebhookController {
	private readonly logger = new Logger(StripeWebhookController.name);

	constructor(
		private readonly stripeService: StripeService,
		private readonly billingService: BillingService,
	) {}

	@Post()
	@HttpCode(200)
	async handleWebhook(
		@RawBody() rawBody: Buffer,
		@Headers("stripe-signature") signature: string,
	) {
		let event: ReturnType<StripeService["constructWebhookEvent"]>;
		try {
			event = this.stripeService.constructWebhookEvent(rawBody, signature);
		} catch (err) {
			this.logger.warn(`Webhook signature verification failed: ${err}`);
			return { received: false };
		}

		switch (event.type) {
			case "checkout.session.completed":
				await this.handleCheckoutCompleted(
					event.data.object as unknown as CheckoutSessionPayload,
				);
				break;

			case "customer.subscription.updated":
				await this.handleSubscriptionUpdated(
					event.data.object as unknown as SubscriptionPayload,
				);
				break;

			case "customer.subscription.deleted":
				await this.handleSubscriptionDeleted(
					event.data.object as unknown as SubscriptionPayload,
				);
				break;

			case "invoice.payment_failed":
				await this.handlePaymentFailed(
					event.data.object as unknown as InvoicePayload,
				);
				break;

			default:
				this.logger.log(`Unhandled event type: ${event.type}`);
		}

		return { received: true };
	}

	private async handleCheckoutCompleted(session: CheckoutSessionPayload) {
		const organizationId = session.client_reference_id;
		if (!organizationId || !session.subscription) return;

		const subscriptionId =
			typeof session.subscription === "string"
				? session.subscription
				: session.subscription.id;

		const sub =
			await this.stripeService.stripe.subscriptions.retrieve(subscriptionId);
		const rawSub = sub as unknown as SubscriptionPayload;
		const priceId = rawSub.items.data[0]?.price.id;
		if (!priceId) return;

		const tier = this.billingService.mapPriceIdToTier(priceId);

		await this.billingService.upsertSubscription({
			organizationId,
			stripeSubscriptionId: sub.id,
			stripePriceId: priceId,
			subscriptionTier: tier,
			status: sub.status,
			currentPeriodStart: new Date(rawSub.current_period_start * 1000),
			currentPeriodEnd: new Date(rawSub.current_period_end * 1000),
			cancelAtPeriodEnd: sub.cancel_at_period_end,
		});

		this.logger.log(`Checkout completed: org=${organizationId} plan=${tier}`);
	}

	private async handleSubscriptionUpdated(sub: SubscriptionPayload) {
		const customerId =
			typeof sub.customer === "string" ? sub.customer : sub.customer.id;

		const billing =
			await this.billingService.findBillingByCustomerId(customerId);
		if (!billing) {
			this.logger.warn(`No billing record for customer ${customerId}`);
			return;
		}

		const priceId = sub.items.data[0]?.price.id;
		if (!priceId) return;

		const tier = this.billingService.mapPriceIdToTier(priceId);

		await this.billingService.upsertSubscription({
			organizationId: billing.organizationId,
			stripeSubscriptionId: sub.id,
			stripePriceId: priceId,
			subscriptionTier: tier,
			status: sub.status,
			currentPeriodStart: new Date(sub.current_period_start * 1000),
			currentPeriodEnd: new Date(sub.current_period_end * 1000),
			cancelAtPeriodEnd: sub.cancel_at_period_end,
		});

		this.logger.log(
			`Subscription updated: org=${billing.organizationId} plan=${tier} status=${sub.status}`,
		);
	}

	private async handleSubscriptionDeleted(sub: SubscriptionPayload) {
		await this.billingService.deleteSubscription(sub.id);
		this.logger.log(`Subscription deleted: ${sub.id}`);
	}

	private async handlePaymentFailed(invoice: InvoicePayload) {
		const subId =
			typeof invoice.subscription === "string"
				? invoice.subscription
				: invoice.subscription?.id;

		if (!subId) return;
		this.logger.warn(`Payment failed for subscription: ${subId}`);
	}
}
