import type { SubscriptionPlan } from "@orbit/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { PricingTable } from "@/components/billing/pricing-table";
import {
	useChangePlan,
	useCheckout,
	useOrgSubscription,
} from "@/hooks/use-billing";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
	validateSearch: (search: Record<string, unknown>) => ({
		checkout: search.checkout as "success" | "canceled" | undefined,
	}),
	component: BillingPage,
});

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function BillingPage() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { checkout: checkoutResult } = useSearch({
		from: "/_workspace/$orgSlug/settings/billing",
	});
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	useEffect(() => {
		if (!checkoutResult) return;
		if (checkoutResult === "success") {
			toast.success("Subscription activated! Welcome to your new plan.");
		} else if (checkoutResult === "canceled") {
			toast.info("Checkout canceled. No changes were made.");
		}
		// Clear the checkout query param by navigating to the same route without it
		navigate({ to: ".", search: (prev) => ({ ...prev, checkout: undefined }) });
	}, [checkoutResult, navigate]);

	const { data } = useOrgSubscription(orgSlug);
	const checkout = useCheckout(orgSlug);
	const changePlan = useChangePlan(orgSlug);

	const hasActiveSubscription =
		data?.subscription != null && ACTIVE_STATUSES.has(data.subscription.status);

	function handleSelectPlan(
		plan: SubscriptionPlan,
		interval: "monthly" | "yearly",
	) {
		if (hasActiveSubscription) {
			changePlan.mutate(
				{ plan, interval },
				{
					onSuccess: () => {
						toast.success("Plan updated successfully.");
						queryClient.invalidateQueries({
							queryKey: ["billing", orgSlug, "subscription"],
						});
					},
					onError: () =>
						toast.error("Could not change plan. Please try again."),
				},
			);
		} else {
			checkout.mutate(
				{ plan, interval },
				{
					onError: () =>
						toast.error("Could not start checkout. Please try again."),
				},
			);
		}
	}

	return (
		<div className="mx-auto max-w-5xl space-y-10 px-4 py-6">
			<div>
				<h1 className="text-xl font-semibold">Billing</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your plan and invoices.
				</p>
			</div>

			<CurrentPlanCard />

			<div>
				<h2 className="mb-4 text-base font-semibold">Plans</h2>
				<PricingTable
					currentPlan={data?.plan ?? "free"}
					onSelectPlan={handleSelectPlan}
				/>
			</div>
		</div>
	);
}
