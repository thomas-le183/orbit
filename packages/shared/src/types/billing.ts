export const SUBSCRIPTION_TIERS = {
	FREE: "free",
	TEAM: "team",
	PRO: "pro",
	ENTERPRISE: "enterprise",
} as const;

export type SubscriptionTier =
	(typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

export interface TierMetadata {
	id: SubscriptionTier;
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

export type TierFlags = TierMetadata["flags"];

// ---------- API response types ----------

export interface SubscriptionResponse {
	tier: SubscriptionTier;
	tierLabel: string;
	usage: {
		members: {
			current: number;
			limit: number;
		};
	};
	subscription: {
		status: string;
		currentPeriodEnd: Date;
		cancelAtPeriodEnd: boolean;
	} | null;
}

export interface CheckoutResponse {
	url: string | null;
}

export interface PortalResponse {
	url: string;
}

// ---------- Tier metadata ----------

export const TIER_METADATA: Record<SubscriptionTier, TierMetadata> = {
	[SUBSCRIPTION_TIERS.FREE]: {
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
	[SUBSCRIPTION_TIERS.TEAM]: {
		id: "team",
		label: "Startup",
		description: "Perfect for early-stage companies and small growing teams.",
		memberLimit: -1,
		monthlyPriceUsd: 19,
		flags: {
			hasAdvancedAnalytics: true,
			hasCustomBranding: false,
			hasSSO: false,
		},
		features: [
			"Unlimited members",
			"Up to 20 projects",
			"Advanced analytics",
			"20 GB storage",
			"Priority email support",
		],
	},
	[SUBSCRIPTION_TIERS.PRO]: {
		id: "pro",
		label: "Business",
		description: "For scaling companies that need advanced workflows.",
		memberLimit: -1,
		monthlyPriceUsd: 59,
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
	[SUBSCRIPTION_TIERS.ENTERPRISE]: {
		id: "enterprise",
		label: "Enterprise",
		description:
			"Dedicated support, custom contracts, and unlimited scale for large organizations.",
		memberLimit: -1,
		monthlyPriceUsd: 199,
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
