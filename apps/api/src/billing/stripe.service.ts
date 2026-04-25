import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import Stripe from "stripe";

@Injectable()
export class StripeService {
	readonly stripe: InstanceType<typeof Stripe>;

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

	async getPriceByLookupKey(lookupKey: string) {
		const prices = await this.stripe.prices.list({
			lookup_keys: [lookupKey],
			limit: 1,
		});
		return prices.data[0] ?? null;
	}

	async getPricesByLookupKeys(lookupKeys: string[]) {
		const prices = await this.stripe.prices.list({
			lookup_keys: lookupKeys,
			limit: lookupKeys.length,
		});
		return Object.fromEntries(
			prices.data.map((p) => [p.lookup_key, p.unit_amount]),
		) as Record<string, number | null>;
	}

	async createCheckoutSession(
		customerId: string,
		lookupKey: string,
		seatCount: number,
		orgSlug: string,
		organizationId: string,
	) {
		const price = await this.getPriceByLookupKey(lookupKey);
		if (!price) throw new Error(`No price found for lookup key: ${lookupKey}`);

		const webBaseUrl = this.config.getOrThrow<string>("WEB_BASE_URL");
		return this.stripe.checkout.sessions.create({
			customer: customerId,
			mode: "subscription",
			line_items: [{ price: price.id, quantity: seatCount }],
			success_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=success`,
			cancel_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=canceled`,
			client_reference_id: organizationId,
		});
	}

	async updateSubscriptionQuantity(
		stripeSubscriptionId: string,
		quantity: number,
	) {
		const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
		const itemId = sub.items.data[0]?.id;
		if (!itemId) throw new Error("Subscription has no items");
		return this.stripe.subscriptions.update(stripeSubscriptionId, {
			items: [{ id: itemId, quantity }],
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
