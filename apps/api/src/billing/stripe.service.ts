import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Stripe } from "stripe";

@Injectable()
export class StripeService {
	readonly stripe: Stripe;

	constructor(private readonly config: ConfigService) {
		const key = config.getOrThrow<string>("STRIPE_SECRET_KEY");
		this.stripe = new Stripe(key);
	}

	async createCustomer(organizationId: string, name: string, email: string) {
		return this.stripe.customers.create({
			name,
			email,
			metadata: { organizationId },
		});
	}

	async createCheckoutSession(
		customerId: string,
		priceId: string,
		orgSlug: string,
		organizationId: string,
	) {
		const webBaseUrl = this.config.getOrThrow<string>("WEB_BASE_URL");
		return this.stripe.checkout.sessions.create({
			customer: customerId,
			mode: "subscription",
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: `${webBaseUrl}/${orgSlug}/settings?tab=billing&checkout=success`,
			cancel_url: `${webBaseUrl}/${orgSlug}/settings?tab=billing&checkout=canceled`,
			client_reference_id: organizationId,
		});
	}

	async createPortalSession(customerId: string, orgSlug: string) {
		const webBaseUrl = this.config.getOrThrow<string>("WEB_BASE_URL");
		return this.stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: `${webBaseUrl}/${orgSlug}/settings?tab=billing`,
		});
	}

	constructWebhookEvent(body: Buffer, signature: string) {
		const secret = this.config.getOrThrow<string>("STRIPE_WEBHOOK_SECRET");
		return this.stripe.webhooks.constructEvent(body, signature, secret);
	}
}
