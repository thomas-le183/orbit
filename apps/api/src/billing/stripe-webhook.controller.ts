import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	Logger,
	Post,
	RawBody,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

/** Minimal fields we need from the raw webhook payload — only IDs, never resource data. */
interface CheckoutSessionPayload {
	client_reference_id: string | null;
	subscription: string | { id: string } | null;
}

interface SubscriptionPayload {
	id: string;
}

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
			throw new BadRequestException("Invalid webhook signature");
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

			case "invoice.paid":
				await this.handleInvoicePaid(
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
		await this.upsertSubscriptionFromStripe(organizationId, sub);
		this.logger.log(`Checkout completed: org=${organizationId}`);
	}

	private async handleSubscriptionUpdated(payload: SubscriptionPayload) {
		const sub = await this.stripeService.stripe.subscriptions.retrieve(
			payload.id,
		);
		const customerId =
			typeof sub.customer === "string" ? sub.customer : sub.customer.id;

		const billing =
			await this.billingService.findBillingByCustomerId(customerId);
		if (!billing) {
			this.logger.warn(`No billing record for customer ${customerId}`);
			return;
		}

		await this.upsertSubscriptionFromStripe(billing.organizationId, sub);
		this.logger.log(
			`Subscription updated: org=${billing.organizationId} status=${sub.status}`,
		);
	}

	private async handleSubscriptionDeleted(payload: SubscriptionPayload) {
		await this.billingService.cancelSubscription(payload.id);
		this.logger.log(`Subscription canceled: ${payload.id}`);
	}

	private async upsertSubscriptionFromStripe(
		organizationId: string,
		sub: Awaited<
			ReturnType<typeof this.stripeService.stripe.subscriptions.retrieve>
		>,
	) {
		const item = sub.items.data[0];
		if (!item?.price) return;

		const plan = this.billingService.mapLookupKeyToPlan(
			(item.price as { lookup_key?: string | null }).lookup_key ?? "",
		);

		await this.billingService.upsertSubscription({
			organizationId,
			stripeSubscriptionId: sub.id,
			stripePriceId: item.price.id,
			subscriptionPlan: plan,
			status: sub.status,
			currentPeriodStart: new Date(item.current_period_start * 1000),
			currentPeriodEnd: new Date(item.current_period_end * 1000),
			cancelAtPeriodEnd: sub.cancel_at_period_end,
		});
	}

	private async handlePaymentFailed(invoice: InvoicePayload) {
		const subId =
			typeof invoice.subscription === "string"
				? invoice.subscription
				: invoice.subscription?.id;

		if (!subId) return;
		await this.billingService.updateSubscriptionStatus(subId, "past_due");
		this.logger.warn(`Payment failed for subscription: ${subId}`);
	}

	private async handleInvoicePaid(invoice: InvoicePayload) {
		const subId =
			typeof invoice.subscription === "string"
				? invoice.subscription
				: invoice.subscription?.id;

		if (!subId) return;
		await this.billingService.updateSubscriptionStatus(subId, "active");
		this.logger.log(`Invoice paid, subscription restored: ${subId}`);
	}
}
