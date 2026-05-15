import type { BillingInterval, SubscriptionPlan } from "@orbit/shared";

export type StripeProrationBehavior =
	| "always_invoice"
	| "create_prorations"
	| "none";

export type StripePriceForSeatBilling = {
	id: string;
	lookup_key?: string | null;
	unit_amount?: number | null;
	recurring?: {
		interval?: string | null;
	} | null;
};

export type StripeSubscriptionForSeatBilling = {
	id: string;
	items: {
		data: Array<{
			id: string;
			quantity?: number | null;
			price: StripePriceForSeatBilling;
		}>;
	};
};

export type StripeClientForSeatBilling = {
	prices: {
		list(params: {
			lookup_keys: string[];
			limit: number;
		}): Promise<{ data: StripePriceForSeatBilling[] }>;
	};
	subscriptions: {
		retrieve(id: string): Promise<StripeSubscriptionForSeatBilling>;
		update(
			id: string,
			params: {
				items: Array<{ id: string; quantity: number }>;
				proration_behavior: StripeProrationBehavior;
			},
		): Promise<unknown>;
	};
};

export const PLAN_LOOKUP_KEYS: Partial<
	Record<SubscriptionPlan, Record<BillingInterval, string>>
> = {
	basic: { monthly: "basic_monthly", yearly: "basic_yearly" },
	business: { monthly: "business_monthly", yearly: "business_yearly" },
};

export function normalizeBillingInterval(
	value: string | null | undefined,
): BillingInterval | null {
	if (value === "monthly" || value === "yearly") return value;
	return null;
}

export function getPlanLookupKey(
	plan: SubscriptionPlan,
	billingInterval: BillingInterval | null | undefined,
): string | null {
	if (!billingInterval) return null;
	return PLAN_LOOKUP_KEYS[plan]?.[billingInterval] ?? null;
}

export function billingIntervalFromStripePrice(
	price: StripePriceForSeatBilling,
): BillingInterval | null {
	if (price.recurring?.interval === "month") return "monthly";
	if (price.recurring?.interval === "year") return "yearly";
	return null;
}

type StripeSubscriptionItem =
	StripeSubscriptionForSeatBilling["items"]["data"][number];

export function resolveSubscriptionItemByPrice(
	subscription: StripeSubscriptionForSeatBilling,
	price: Pick<StripePriceForSeatBilling, "id" | "lookup_key">,
): StripeSubscriptionItem | null {
	return (
		subscription.items.data.find(
			(item) =>
				item.price.id === price.id ||
				(price.lookup_key != null &&
					item.price.lookup_key === price.lookup_key),
		) ?? null
	);
}

export function resolveSubscriptionItemByLookupKey(
	subscription: StripeSubscriptionForSeatBilling,
	lookupKey: string,
): StripeSubscriptionItem | null {
	return (
		subscription.items.data.find(
			(item) => item.price.lookup_key === lookupKey,
		) ?? null
	);
}

export function inferBillingIntervalFromStripeSubscription(
	subscription: StripeSubscriptionForSeatBilling,
	plan: SubscriptionPlan,
): BillingInterval | null {
	const lookupKeys = PLAN_LOOKUP_KEYS[plan];
	if (!lookupKeys) return null;

	const lookupKeySet = new Set(Object.values(lookupKeys));
	const item = subscription.items.data.find((item) =>
		item.price.lookup_key ? lookupKeySet.has(item.price.lookup_key) : false,
	);

	return item ? billingIntervalFromStripePrice(item.price) : null;
}

export async function getStripePriceByLookupKey(
	stripe: StripeClientForSeatBilling,
	lookupKey: string,
): Promise<StripePriceForSeatBilling | null> {
	const prices = await stripe.prices.list({
		lookup_keys: [lookupKey],
		limit: 1,
	});

	return prices.data[0] ?? null;
}
