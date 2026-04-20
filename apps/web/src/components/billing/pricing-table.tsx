import {
	SUBSCRIPTION_TIERS,
	type SubscriptionTier,
	TIER_METADATA,
} from "@orbit/shared";
import { Pricing } from "@orbit/ui/components/pricing";

interface PricingTableProps {
	currentTier: SubscriptionTier;
	highlightTier?: SubscriptionTier;
	onSelectTier?: (tier: SubscriptionTier) => void;
}

const TIER_ORDER: SubscriptionTier[] = [
	SUBSCRIPTION_TIERS.FREE,
	SUBSCRIPTION_TIERS.TEAM,
	SUBSCRIPTION_TIERS.PRO,
	SUBSCRIPTION_TIERS.ENTERPRISE,
];

function yearlyMonthlyPrice(monthlyUsd: number): number {
	return Math.round((monthlyUsd * 10) / 12);
}

export function PricingTable({
	currentTier,
	highlightTier,
	onSelectTier,
}: PricingTableProps) {
	const effectiveHighlight = highlightTier ?? SUBSCRIPTION_TIERS.PRO;

	const plans = TIER_ORDER.map((tier, index) => {
		const meta = TIER_METADATA[tier];
		const isCurrent = tier === currentTier;
		const isHighlighted = tier === effectiveHighlight;
		const isEnterprise = tier === SUBSCRIPTION_TIERS.ENTERPRISE;
		const isPaid = meta.monthlyPriceUsd > 0 && !isEnterprise;
		const prevLabel = index > 0 ? TIER_METADATA[TIER_ORDER[index - 1]].label : null;

		return {
			id: tier,
			name: meta.label,
			description: meta.description,
			price: meta.monthlyPriceUsd,
			period: isEnterprise ? undefined : "per seat/month",
			yearlyPrice: isPaid
				? yearlyMonthlyPrice(meta.monthlyPriceUsd)
				: undefined,
			badge: isHighlighted && !isEnterprise ? "Most popular" : undefined,
			highlighted: isHighlighted && !isEnterprise,
			featuresPrefix: prevLabel ? `Everything in ${prevLabel}, plus:` : undefined,
			features: [...meta.features],
			isEnterprise,
			cta: isCurrent
				? "Current plan"
				: isEnterprise
					? "Contact Sales"
					: tier === SUBSCRIPTION_TIERS.FREE
						? "Downgrade"
						: "Get started",
			ctaDisabled: isCurrent || tier === SUBSCRIPTION_TIERS.FREE,
			onCta:
				isCurrent || tier === SUBSCRIPTION_TIERS.FREE
					? undefined
					: () => onSelectTier?.(tier),
		};
	});

	return <Pricing plans={plans} />;
}
