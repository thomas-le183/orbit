import {
	PLAN_METADATA,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { Pricing } from "@orbit/ui/components/pricing";

const PLAN_ORDER: SubscriptionPlan[] = [
	SUBSCRIPTION_PLANS.FREE,
	SUBSCRIPTION_PLANS.BASIC,
	SUBSCRIPTION_PLANS.BUSINESS,
	SUBSCRIPTION_PLANS.ENTERPRISE,
];

function yearlyMonthlyPrice(monthlyUsd: number): number {
	return Math.round((monthlyUsd * 10) / 12);
}

export function buildPricingPlans(
	currentPlan: SubscriptionPlan,
	hasActiveSubscription: boolean,
	isPending: boolean,
	highlightPlan: SubscriptionPlan = SUBSCRIPTION_PLANS.BUSINESS,
	onSelectPlan?: (plan: SubscriptionPlan, interval: "monthly" | "yearly") => void,
) {
	const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);

	return PLAN_ORDER.map((plan, index) => {
		const meta = PLAN_METADATA[plan];
		const isCurrent = plan === currentPlan;
		const isHighlighted = plan === highlightPlan;
		const isEnterprise = plan === SUBSCRIPTION_PLANS.ENTERPRISE;
		const isPaid = meta.monthlyPriceUsd > 0 && !isEnterprise;
		const isFree = plan === SUBSCRIPTION_PLANS.FREE;
		const isUpgrade = index > currentPlanIndex;
		const prevLabel = index > 0 ? PLAN_METADATA[PLAN_ORDER[index - 1]].label : null;

		const cta = isCurrent
			? "Current plan"
			: isEnterprise
				? "Contact Sales"
				: isFree
					? "Downgrade to free"
					: hasActiveSubscription
						? isUpgrade ? "Upgrade" : "Downgrade"
						: "Get started";

		const ctaDisabled = isCurrent || isFree || isPending;

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
			cta,
			ctaDisabled,
			onCta: ctaDisabled
				? undefined
				: (period: "monthly" | "yearly") => onSelectPlan?.(plan, period),
		};
	});
}

export function PricingTable({
	currentPlan,
	highlightPlan,
	hasActiveSubscription = false,
	isPending = false,
	onSelectPlan,
}: {
	currentPlan: SubscriptionPlan;
	highlightPlan?: SubscriptionPlan;
	hasActiveSubscription?: boolean;
	isPending?: boolean;
	onSelectPlan?: (plan: SubscriptionPlan, interval: "monthly" | "yearly") => void;
}) {
	const plans = buildPricingPlans(
		currentPlan,
		hasActiveSubscription,
		isPending,
		highlightPlan,
		onSelectPlan,
	);
	return <Pricing plans={plans} />;
}
