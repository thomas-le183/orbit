import type { PlanResponse, SubscriptionPlan, SubscriptionResponse } from "@orbit/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function usePlans() {
	return useQuery({
		queryKey: ["billing", "plans"],
		queryFn: async () => {
			const { data } = await api.get<PlanResponse[]>("/billing/plans");
			return data;
		},
		staleTime: 1000 * 60 * 60,
	});
}

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
		mutationFn: async ({
			plan,
			interval,
		}: {
			plan: SubscriptionPlan;
			interval: "monthly" | "yearly";
		}) => {
			const { data } = await api.post<{ url: string }>(
				`/billing/${orgSlug}/checkout`,
				{ plan, interval },
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
