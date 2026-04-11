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
		label: "Hobby", // Friendly name for developers/testers
		description: "Great for testing and side projects.",
		memberLimit: 5,
		monthlyPriceUsd: 0,
		flags: {
			hasAdvancedAnalytics: false,
			hasCustomBranding: false,
			hasSSO: false,
		},
		features: ["Up to 5 team members", "Basic workspace", "Community support"],
	},
	[SUBSCRIPTION_TIERS.TEAM]: {
		id: "team",
		label: "Startup", // Fits smaller organizations
		description: "Perfect for early-stage companies and small agencies.",
		memberLimit: 25,
		monthlyPriceUsd: 19,
		flags: {
			hasAdvancedAnalytics: true, // They get basic charts
			hasCustomBranding: false,
			hasSSO: false,
		},
		features: [
			"Up to 25 team members",
			"Advanced analytics",
			"Priority email support",
		],
	},
	[SUBSCRIPTION_TIERS.PRO]: {
		id: "pro",
		label: "Business", // Heavier tier for established teams
		description: "For scaling companies with advanced workflow needs.",
		memberLimit: 100,
		monthlyPriceUsd: 59,
		flags: {
			hasAdvancedAnalytics: true,
			hasCustomBranding: true, // They can upload their own logo/theme
			hasSSO: false,
		},
		features: [
			"Up to 100 team members",
			"Custom white-label branding",
			"Shared team templates",
		],
	},
	[SUBSCRIPTION_TIERS.ENTERPRISE]: {
		id: "enterprise",
		label: "Enterprise", // Classic big-corp tier
		description: "Maximum security, custom control, and limitless scale.",
		memberLimit: -1,
		monthlyPriceUsd: 199,
		flags: {
			hasAdvancedAnalytics: true,
			hasCustomBranding: true,
			hasSSO: true, // Only whales get SAML/SSO
		},
		features: [
			"Unlimited team members",
			"SAML & Single Sign-On (SSO)",
			"Dedicated account manager",
			"99.9% uptime SLA",
		],
	},
};
