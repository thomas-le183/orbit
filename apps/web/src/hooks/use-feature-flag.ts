import {
	SUBSCRIPTION_TIERS,
	type SubscriptionTier,
	TIER_METADATA,
	type TierFlags,
} from "@orbit/shared";
import { useParams } from "@tanstack/react-router";
import { useOrgSubscription } from "@/hooks/use-billing";

const TIER_ORDER: SubscriptionTier[] = [
	SUBSCRIPTION_TIERS.FREE,
	SUBSCRIPTION_TIERS.TEAM,
	SUBSCRIPTION_TIERS.PRO,
	SUBSCRIPTION_TIERS.ENTERPRISE,
];

export function useFeatureFlag(flag: keyof TierFlags): {
	enabled: boolean;
	requiredTier: SubscriptionTier;
} {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data, isLoading, isError } = useOrgSubscription(orgSlug);

	if (isLoading || isError || !data) {
		return { enabled: true, requiredTier: SUBSCRIPTION_TIERS.FREE };
	}

	const enabled = TIER_METADATA[data.tier].flags[flag];
	const requiredTier =
		TIER_ORDER.find((t) => TIER_METADATA[t].flags[flag]) ??
		SUBSCRIPTION_TIERS.ENTERPRISE;

	return { enabled, requiredTier };
}
