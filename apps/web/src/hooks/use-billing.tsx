import type {
	PlanResponse,
	SubscriptionPlan,
	SubscriptionResponse,
} from "@orbit/shared";
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

export function useStartTrial(orgSlug: string) {
	return useMutation({
		mutationFn: async () => {
			const { data } = await api.post<{ status: string }>(
				`/billing/${orgSlug}/start-trial`,
			);
			return data;
		},
	});
}

export function useChangePlan(orgSlug: string) {
	return useMutation({
		mutationFn: async ({
			plan,
			interval,
			endTrial,
		}: {
			plan: SubscriptionPlan;
			interval: "monthly" | "yearly";
			endTrial?: boolean;
		}) => {
			const { data } = await api.post<{ success: boolean; url?: string }>(
				`/billing/${orgSlug}/change-plan`,
				{ plan, interval, endTrial },
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

export function useCancelSubscription(orgSlug: string) {
	return useMutation({
		mutationFn: async () => {
			const { data } = await api.post<{ success: boolean }>(
				`/billing/${orgSlug}/cancel`,
			);
			return data;
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
