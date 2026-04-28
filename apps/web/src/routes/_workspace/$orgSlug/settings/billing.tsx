import { Button } from "@orbit/ui/components/button";
import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@orbit/ui/components/field";
import {
	createFileRoute,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { SubscriptionSection } from "@/components/billing/subscription-section";
import { usePortal } from "@/hooks/use-billing";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
	validateSearch: (search: Record<string, unknown>) => ({
		checkout: search.checkout as "success" | "canceled" | undefined,
	}),
	component: BillingPage,
});

function BillingPage() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { checkout: checkoutResult } = useSearch({
		from: "/_workspace/$orgSlug/settings/billing",
	});
	const navigate = useNavigate();

	useEffect(() => {
		if (!checkoutResult) return;
		if (checkoutResult === "success") {
			toast.success("Subscription activated! Welcome to your new plan.");
		} else if (checkoutResult === "canceled") {
			toast.info("Checkout canceled. No changes were made.");
		}
		navigate({ to: ".", search: (prev) => ({ ...prev, checkout: undefined }) });
	}, [checkoutResult, navigate]);

	const portal = usePortal(orgSlug);

	function handlePortal() {
		portal.mutate(undefined, {
			onError: () => toast.error("Could not open billing portal."),
		});
	}

	return (
		<div className="mx-auto w-2xl max-w-5xl space-y-10 px-4 py-6">
			<div>
				<h1 className="text-xl font-semibold">Billing</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your plan and invoices.
				</p>
			</div>

			<SubscriptionSection />

			<FieldSet>
				<FieldLegend>Manage billing information</FieldLegend>
				<FieldDescription>
					Update your payment method and billing details.
				</FieldDescription>
				<Button
					variant="outline"
					size="sm"
					onClick={handlePortal}
					disabled={portal.isPending}
					className={"max-w-min"}
				>
					<CreditCard />
					Manage billing information
				</Button>
			</FieldSet>
		</div>
	);
}
