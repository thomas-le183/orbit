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
		trialDays?: number,
	) {
		const price = await this.getPriceByLookupKey(lookupKey);
		if (!price) throw new Error(`No price found for lookup key: ${lookupKey}`);

		const webBaseUrl = this.config.getOrThrow<string>("WEB_BASE_URL");
		return this.stripe.checkout.sessions.create({
			customer: customerId,
			mode: "subscription",
			line_items: [{ price: price.id, quantity: seatCount }],
			subscription_data: {
				metadata: { organizationId },
				...(trialDays ? { trial_period_days: trialDays } : {}),
			},
			success_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=success`,
			cancel_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=canceled`,
			client_reference_id: organizationId,
		});
	}

	async createTrialSubscription(
		customerId: string,
		lookupKey: string,
		organizationId: string,
	) {
		const price = await this.getPriceByLookupKey(lookupKey);
		if (!price) throw new Error(`No price found for lookup key: ${lookupKey}`);

		return this.stripe.subscriptions.create({
			customer: customerId,
			items: [{ price: price.id }],
			trial_period_days: 7,
			trial_settings: {
				end_behavior: { missing_payment_method: "cancel" },
			},
			metadata: { organizationId },
			payment_settings: { save_default_payment_method: "on_subscription" },
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

	async changePlan(
		stripeSubscriptionId: string,
		newLookupKey: string,
		currentPlanTier: number,
		newPlanTier: number,
	) {
		const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
		const item = sub.items.data[0];
		if (!item) throw new Error("Subscription has no items");

		const newPrice = await this.getPriceByLookupKey(newLookupKey);
		if (!newPrice) throw new Error(`No price found for lookup key: ${newLookupKey}`);

		let isUpgrade: boolean;
		if (newPlanTier !== currentPlanTier) {
			isUpgrade = newPlanTier > currentPlanTier;
		} else {
			const currentInterval = item.price.recurring?.interval;
			isUpgrade = currentInterval === "month" && newPrice.recurring?.interval === "year";
		}

		return this.stripe.subscriptions.update(stripeSubscriptionId, {
			items: [{ id: item.id, price: newPrice.id }],
			proration_behavior: isUpgrade ? "create_prorations" : "none",
		});
	}

	async createPortalSession(customerId: string, orgSlug: string) {
		const webBaseUrl = this.config.getOrThrow<string>("WEB_BASE_URL");
		return this.stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: `${webBaseUrl}/${orgSlug}/settings/billing`,
		});
	}

	async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string) {
		return this.stripe.subscriptions.update(stripeSubscriptionId, {
			cancel_at_period_end: true,
		});
	}

	constructWebhookEvent(body: Buffer, signature: string) {
		const secret = this.config.getOrThrow<string>("STRIPE_WEBHOOK_SECRET");
		return this.stripe.webhooks.constructEvent(body, signature, secret);
	}
}
