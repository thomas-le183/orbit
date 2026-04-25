import {
	PLAN_METADATA,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { Pricing } from "@orbit/ui/components/pricing";

interface PricingTableProps {
	currentPlan: SubscriptionPlan;
	highlightPlan?: SubscriptionPlan;
	onSelectPlan?: (plan: SubscriptionPlan) => void;
}

const PLAN_ORDER: SubscriptionPlan[] = [
	SUBSCRIPTION_PLANS.FREE,
	SUBSCRIPTION_PLANS.BASIC,
	SUBSCRIPTION_PLANS.BUSINESS,
	SUBSCRIPTION_PLANS.ENTERPRISE,
];

function yearlyMonthlyPrice(monthlyUsd: number): number {
	return Math.round((monthlyUsd * 10) / 12);
}

export function PricingTable({
	currentPlan,
	highlightPlan,
	onSelectPlan,
}: PricingTableProps) {
	const effectiveHighlight = highlightPlan ?? SUBSCRIPTION_PLANS.BUSINESS;

	const plans = PLAN_ORDER.map((plan, index) => {
		const meta = PLAN_METADATA[plan];
		const isCurrent = plan === currentPlan;
		const isHighlighted = plan === effectiveHighlight;
		const isEnterprise = plan === SUBSCRIPTION_PLANS.ENTERPRISE;
		const isPaid = meta.monthlyPriceUsd > 0 && !isEnterprise;
		const prevLabel = index > 0 ? PLAN_METADATA[PLAN_ORDER[index - 1]].label : null;

		return {
			id: plan,
			name: meta.label,
			description: meta.description,
			price: meta.monthlyPriceUsd,
			period: isEnterprise ? undefined : "per seat/month",
			yearlyPrice: isPaid ? yearlyMonthlyPrice(meta.monthlyPriceUsd) : undefined,
			badge: isHighlighted && !isEnterprise ? "Most popular" : undefined,
			highlighted: isHighlighted && !isEnterprise,
			featuresPrefix: prevLabel ? `Everything in ${prevLabel}, plus:` : undefined,
			features: [...meta.features],
			isEnterprise,
			cta: isCurrent
				? "Current plan"
				: isEnterprise
					? "Contact Sales"
					: plan === SUBSCRIPTION_PLANS.FREE
						? "Downgrade"
						: "Get started",
			ctaDisabled: isCurrent || plan === SUBSCRIPTION_PLANS.FREE,
			onCta:
				isCurrent || plan === SUBSCRIPTION_PLANS.FREE
					? undefined
					: () => onSelectPlan?.(plan),
		};
	});

	return <Pricing plans={plans} />;
}
