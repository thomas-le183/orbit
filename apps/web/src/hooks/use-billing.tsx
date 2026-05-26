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
	const orgId = useOrgId();

	return useQuery({
		queryKey: ["billing", orgSlug, "subscription"],
		queryFn: async () => {
			if (!orgId) throw new Error("No active organization");

			const [subsResult, orgResult] = await Promise.all([
				authClient.subscription.list({
					query: { referenceId: orgId, customerType: "organization" },
				}),
				authClient.organization.getFullOrganization({
					query: { organizationId: orgId },
				}),
			]);

			if (subsResult.error) throw new Error(subsResult.error.message);
			if (orgResult.error) throw new Error(orgResult.error.message);

			const now = Date.now();
			const activeSubscription =
				subsResult.data?.find((sub) => {
					if (["active", "trialing", "past_due"].includes(sub.status)) return true;
					// Canceled but still within access window (e.g. trial canceled before checkout)
					if (
						sub.status === "canceled" &&
						sub.periodEnd &&
						new Date(sub.periodEnd).getTime() > now
					)
						return true;
					return false;
				}) ?? null;

			return {
				subscription: activeSubscription,
				memberCount: orgResult.data?.members?.length ?? 0,
			};
		},
		enabled: !!orgId,
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
			const { data, error } = await authClient.subscription.upgrade({
				plan,
				referenceId: orgId,
				annual: interval === "yearly",
				customerType: "organization",
				successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success`,
				cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
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
				customerType: "organization",
				metadata: { noCard: "true" },
				successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success`,
				cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
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
			const { data, error } = await authClient.subscription.upgrade({
				plan,
				referenceId: orgId,
				customerType: "organization",
				annual: interval === "yearly",
				...(subscriptionId ? { subscriptionId } : {}),
				successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success`,
				cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
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

export function useActivateTrial(orgSlug: string) {
	return useMutation({
		mutationFn: async () => {
			const { data } = await api.post<{ url: string }>(
				`/billing/${orgSlug}/activate-trial`,
				{
					successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success`,
					cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
				},
			);
			return data;
		},
		onSuccess: (data) => {
			if (data?.url) window.location.href = data.url;
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
