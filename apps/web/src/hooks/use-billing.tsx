import type {
	PlanResponse,
	SubscriptionPlan,
	SubscriptionResponse,
} from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

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

function useOrgId() {
	const { data: session } = authClient.useSession();
	return session?.session.activeOrganizationId ?? null;
}

export function useCheckout(orgSlug: string) {
	const orgId = useOrgId();

	return useMutation({
		mutationFn: async ({
			plan,
			interval,
		}: {
			plan: SubscriptionPlan;
			interval: "monthly" | "yearly";
		}) => {
			if (!orgId) throw new Error("No active organization");
			const { data, error } = await authClient.subscription.upgrade({
				plan,
				referenceId: orgId,
				annual: interval === "yearly",
				successUrl: `${window.location.origin}/${orgSlug}/settings/billing?checkout=success`,
				cancelUrl: `${window.location.origin}/${orgSlug}/settings/billing?checkout=canceled`,
			});
			if (error) throw new Error(error.message);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) window.location.href = data.url;
		},
	});
}

export function useStartTrial(orgSlug: string) {
	return useCheckout(orgSlug);
}

export function useChangePlan(orgSlug: string) {
	const orgId = useOrgId();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			plan,
			interval,
		}: {
			plan: SubscriptionPlan;
			interval: "monthly" | "yearly";
		}) => {
			if (!orgId) throw new Error("No active organization");
			const { data, error } = await authClient.subscription.upgrade({
				plan,
				referenceId: orgId,
				annual: interval === "yearly",
				successUrl: `${window.location.origin}/${orgSlug}/settings/billing?checkout=success`,
				cancelUrl: `${window.location.origin}/${orgSlug}/settings/billing?checkout=canceled`,
			});
			if (error) throw new Error(error.message);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) {
				window.location.href = data.url;
			} else {
				void queryClient.invalidateQueries({
					queryKey: ["billing", orgSlug, "subscription"],
				});
			}
		},
	});
}

export function useCancelSubscription(orgSlug: string) {
	const orgId = useOrgId();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			if (!orgId) throw new Error("No active organization");
			const { error } = await authClient.subscription.cancel({
				referenceId: orgId,
				returnUrl: `${window.location.origin}/${orgSlug}/settings/billing`,
			});
			if (error) throw new Error(error.message);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["billing", orgSlug, "subscription"],
			});
		},
	});
}

export function usePortal(orgSlug: string) {
	const orgId = useOrgId();

	return useMutation({
		mutationFn: async () => {
			if (!orgId) throw new Error("No active organization");
			const { data, error } = await authClient.subscription.billingPortal({
				referenceId: orgId,
				returnUrl: `${window.location.origin}/${orgSlug}/settings/billing`,
			});
			if (error) throw new Error(error.message);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) window.location.href = data.url;
		},
	});
}
