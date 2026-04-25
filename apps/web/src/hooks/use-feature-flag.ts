import {
	PLAN_METADATA,
	type PlanFlags,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
} from "@orbit/shared";
import { useParams } from "@tanstack/react-router";
import { useOrgSubscription } from "@/hooks/use-billing";

const PLAN_ORDER: SubscriptionPlan[] = [
	SUBSCRIPTION_PLANS.FREE,
	SUBSCRIPTION_PLANS.BASIC,
	SUBSCRIPTION_PLANS.BUSINESS,
	SUBSCRIPTION_PLANS.ENTERPRISE,
];

export function useFeatureFlag(flag: keyof PlanFlags): {
	enabled: boolean;
	requiredPlan: SubscriptionPlan;
} {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data, isLoading, isError } = useOrgSubscription(orgSlug);

	if (isLoading || isError || !data) {
		return { enabled: true, requiredPlan: SUBSCRIPTION_PLANS.FREE };
	}

	const enabled = PLAN_METADATA[data.plan].flags[flag];
	const requiredPlan =
		PLAN_ORDER.find((p) => PLAN_METADATA[p].flags[flag]) ??
		SUBSCRIPTION_PLANS.ENTERPRISE;

	return { enabled, requiredPlan };
}
