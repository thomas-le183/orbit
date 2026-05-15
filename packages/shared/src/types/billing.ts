export const SUBSCRIPTION_PLANS = {
	FREE: "free",
	BASIC: "basic",
	BUSINESS: "business",
	ENTERPRISE: "enterprise",
} as const;

export type SubscriptionPlan =
	(typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

export type BillingInterval = "monthly" | "yearly";

export interface PlanMetadata {
	id: SubscriptionPlan;
	label: string;
	description: string;
	memberLimit: number; // -1 = unlimited
	monthlyPriceUsd: number;

	flags: {
		hasAdvancedAnalytics: boolean;
		hasCustomBranding: boolean;
		hasSSO: boolean;
	};

	features: readonly string[];
}

export type PlanFlags = PlanMetadata["flags"];

// ---------- API response types ----------

export interface SubscriptionResponse {
	plan: SubscriptionPlan;
	planLabel: string;
	trialEligible: boolean;
	pricePerSeat: number | null;
	billingInterval: BillingInterval | null;
	usage: {
		members: {
			current: number;
			limit: number;
		};
	};
	subscription: {
		status: string;
		currentPeriodStart: Date;
		currentPeriodEnd: Date;
		cancelAtPeriodEnd: boolean;
	} | null;
}

export interface PlanPrice {
	monthly: number | null;
	yearly: number | null;
}

export interface PlanResponse {
	id: SubscriptionPlan;
	label: string;
	description: string;
	price: PlanPrice;
	features: readonly string[];
	flags: PlanMetadata["flags"];
	isEnterprise: boolean;
}

export interface CheckoutResponse {
	url: string | null;
}

export interface PortalResponse {
	url: string;
}

// ---------- Plan metadata ----------

export const PLAN_METADATA: Record<SubscriptionPlan, PlanMetadata> = {
	[SUBSCRIPTION_PLANS.FREE]: {
		id: "free",
		label: "Hobby",
		description: "Great for individual developers and side projects.",
		memberLimit: -1,
		monthlyPriceUsd: 0,
		flags: {
			hasAdvancedAnalytics: false,
			hasCustomBranding: false,
			hasSSO: false,
		},
		features: [
			"Unlimited members",
			"Up to 3 projects",
			"Basic workspace",
			"1 GB storage",
			"Community support",
		],
	},
	[SUBSCRIPTION_PLANS.BASIC]: {
		id: "basic",
		label: "Basic",
		description: "For small teams getting started.",
		memberLimit: -1,
		monthlyPriceUsd: 10,
		flags: {
			hasAdvancedAnalytics: false,
			hasCustomBranding: false,
			hasSSO: false,
		},
		features: [],
	},
	[SUBSCRIPTION_PLANS.BUSINESS]: {
		id: "business",
		label: "Business",
		description: "For scaling companies that need advanced workflows.",
		memberLimit: -1,
		monthlyPriceUsd: 15,
		flags: {
			hasAdvancedAnalytics: true,
			hasCustomBranding: true,
			hasSSO: false,
		},
		features: [
			"Unlimited members",
			"Unlimited projects",
			"Custom white-label branding",
			"100 GB storage",
			"Shared team templates",
			"API access",
		],
	},
	[SUBSCRIPTION_PLANS.ENTERPRISE]: {
		id: "enterprise",
		label: "Enterprise",
		description:
			"Dedicated support, custom contracts, and unlimited scale for large organizations.",
		memberLimit: -1,
		monthlyPriceUsd: 0,
		flags: {
			hasAdvancedAnalytics: true,
			hasCustomBranding: true,
			hasSSO: true,
		},
		features: [
			"Everything in Business",
			"SAML & Single Sign-On (SSO)",
			"Unlimited storage",
			"Custom integrations",
			"Dedicated account manager",
			"99.9% uptime SLA",
		],
	},
};
