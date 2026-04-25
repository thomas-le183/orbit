import type { SubscriptionPlan } from "@orbit/shared";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { PricingTable } from "@/components/billing/pricing-table";
import { useCheckout, useOrgSubscription } from "@/hooks/use-billing";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
	component: BillingPage,
});

function BillingPage() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data } = useOrgSubscription(orgSlug);
	const checkout = useCheckout(orgSlug);

	function handleSelectPlan(plan: SubscriptionPlan, interval: "monthly" | "yearly") {
		checkout.mutate(
			{ plan, interval },
			{ onError: () => toast.error("Could not start checkout. Please try again.") },
		);
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
