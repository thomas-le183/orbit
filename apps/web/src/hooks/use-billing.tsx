import {
	PLAN_METADATA,
	type PlanResponse,
	SUBSCRIPTION_PLANS,
	type SubscriptionPlan,
	type SubscriptionResponse,
} from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export function usePlans() {
	return useQuery({
		queryKey: ["billing", "plans"],
		queryFn: (): PlanResponse[] =>
			(Object.values(SUBSCRIPTION_PLANS) as SubscriptionPlan[]).map((plan) => {
				const meta = PLAN_METADATA[plan];
				return {
					id: plan,
					label: meta.label,
					description: meta.description,
					features: meta.features,
					flags: meta.flags,
					isEnterprise: plan === SUBSCRIPTION_PLANS.ENTERPRISE,
					price: {
						monthly: meta.monthlyPriceUsd > 0 ? meta.monthlyPriceUsd : null,
						yearly: null,
					},
				};
			}),
		staleTime: Number.POSITIVE_INFINITY,
	});
}

function useOrgId() {
	const { data: session } = authClient.useSession();
	return session?.session.activeOrganizationId ?? null;
}

export function useOrgSubscription(orgSlug: string) {
	return useQuery({
		queryKey: ["billing", orgSlug, "subscription"],
		queryFn: async () => {
			const { data } = await api.get<SubscriptionResponse>(
				`/billing/${orgSlug}/subscription`,
			);
			return {
				subscription: data.subscription,
				memberCount: data.usage.members.current,
				accessPlan: data.plan,
			};
		},
		enabled: orgSlug.length > 0,
	});
}

export function useBillingSummary(orgSlug: string) {
	return useQuery({
		queryKey: ["billing", orgSlug, "subscription-summary"],
		queryFn: async () => {
			const { data } = await api.get<SubscriptionResponse>(
				`/billing/${orgSlug}/subscription`,
			);
			return data;
		},
		enabled: orgSlug.length > 0,
	});
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
			const base = `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing`;
			const { data, error } = await authClient.subscription.upgrade({
				plan,
				referenceId: orgId,
				annual: interval === "yearly",
				customerType: "organization",
				successUrl: `${base}?checkout=success`,
				cancelUrl: `${base}?checkout=canceled`,
				returnUrl: base,
			});

			if (error) throw new Error(error.message);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) window.location.href = data.url;
		},
	});
}

export function useChangePlan(orgSlug: string) {
	const orgId = useOrgId();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			plan,
			interval,
			subscriptionId,
		}: {
			plan: SubscriptionPlan;
			interval: "monthly" | "yearly";
			subscriptionId?: string;
		}) => {
			if (!orgId) throw new Error("No active organization");
			const base = `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing`;
			const { data, error } = await authClient.subscription.upgrade({
				plan,
				referenceId: orgId,
				customerType: "organization",
				annual: interval === "yearly",
				...(subscriptionId ? { subscriptionId } : {}),
				successUrl: `${base}?checkout=success`,
				cancelUrl: `${base}?checkout=canceled`,
				returnUrl: base,
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

export function useConvertTrial(orgSlug: string) {
	return useMutation({
		mutationFn: async ({
			successUrl,
			cancelUrl,
		}: {
			successUrl: string;
			cancelUrl: string;
		}) => {
			const { data } = await api.post<{ url: string }>(
				`/billing/${orgSlug}/convert-trial`,
				{ successUrl, cancelUrl },
			);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) window.location.href = data.url;
		},
	});
}

export function useActivateTrial(orgSlug: string) {
	return useMutation({
		mutationFn: async ({ sessionId }: { sessionId: string }) => {
			await api.post(`/billing/${orgSlug}/activate-trial`, { sessionId });
		},
	});
}

export function useCancelSubscription(orgSlug: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			await api.post(`/billing/${orgSlug}/cancel`);
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
				returnUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing`,
				customerType: "organization",
			});
			if (error) throw new Error(error.message);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) window.location.href = data.url;
		},
	});
}
