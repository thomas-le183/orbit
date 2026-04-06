import type { SubscriptionResponse, SubscriptionTier } from "@orbit/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useOrgSubscription(orgSlug: string) {
	return useQuery({
		queryKey: ["billing", orgSlug, "subscription"],
		queryFn: async () => {
			const { data } = await api.get<SubscriptionResponse>(
				`/billing/${orgSlug}/subscription`,
			);
			return data;
		},
	});
}

export function useCheckout(orgSlug: string) {
	return useMutation({
		mutationFn: async (tier: SubscriptionTier) => {
			const { data } = await api.post<{ url: string }>(
				`/billing/${orgSlug}/checkout`,
				{ tier },
			);
			return data;
		},
		onSuccess: (data) => {
			if (data.url) {
				window.location.href = data.url;
			}
		},
	});
}

export function usePortal(orgSlug: string) {
	return useMutation({
		mutationFn: async () => {
			const { data } = await api.post<{ url: string }>(
				`/billing/${orgSlug}/portal`,
			);
			return data;
		},
		onSuccess: (data) => {
			if (data.url) {
				window.location.href = data.url;
			}
		},
	});
}
