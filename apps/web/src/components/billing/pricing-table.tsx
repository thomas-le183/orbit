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

export function PricingTable({
	currentTier,
	highlightTier,
	onSelectTier,
}: PricingTableProps) {
	const effectiveHighlight = highlightTier ?? SUBSCRIPTION_TIERS.PRO;

	const plans = TIER_ORDER.map((tier) => {
		const meta = TIER_METADATA[tier];
		const isCurrent = tier === currentTier;
		const isHighlighted = tier === effectiveHighlight;

		return {
			id: tier,
			name: meta.label,
			description: meta.description,
			price: meta.monthlyPriceUsd === 0 ? "Free" : `$${meta.monthlyPriceUsd}`,
			period: meta.monthlyPriceUsd === 0 ? undefined : "/ mo",
			badge: isHighlighted ? "Most popular" : undefined,
			highlighted: isHighlighted,
			features: [...meta.features],
			cta: isCurrent
				? "Current plan"
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
