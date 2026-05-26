import { Alert, AlertDescription } from "@orbit/ui/components/alert";
import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@orbit/ui/components/dialog";
import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@orbit/ui/components/field";
import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	redirect,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { AlertTriangle, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlanSummaryCard } from "@/components/billing/plan-summary-card";
import { loadOrgRole } from "@/hooks/use-auth";
import {
	useCancelSubscription,
	useOrgSubscription,
	usePortal,
} from "@/hooks/use-billing";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
	beforeLoad: async ({ context, params }) => {
		const { authState, targetOrg } = context;
		const role = await loadOrgRole(
			context.queryClient,
			targetOrg.id,
			authState.user?.id ?? "",
		);
		if (role === "member" || role === null) {
			throw redirect({ to: "/$orgSlug", params });
		}
	},
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
	const queryClient = useQueryClient();
	const { data } = useOrgSubscription(orgSlug);
	const portal = usePortal(orgSlug);
	const cancelSubscription = useCancelSubscription(orgSlug);
	const [cancelModalOpen, setCancelModalOpen] = useState(false);
	const sub = data?.subscription;
	const isPastDue = sub?.status === "past_due";
	const canCancel =
		sub != null &&
		["active", "trialing", "past_due"].includes(sub.status) &&
		!sub.cancelAtPeriodEnd;

	useEffect(() => {
		if (!checkoutResult) return;
		if (checkoutResult === "success") {
			toast.success("Subscription activated! Welcome to your new plan.");
			void queryClient.invalidateQueries({
				queryKey: ["billing", orgSlug, "subscription"],
			});
		} else if (checkoutResult === "canceled") {
			toast.info("Checkout canceled. No changes were made.");
		}
		navigate({ to: ".", search: (prev) => ({ ...prev, checkout: undefined }) });
	}, [checkoutResult, navigate, queryClient, orgSlug]);

	function handlePortal() {
		portal.mutate(undefined, {
			onError: () => toast.error("Could not open billing portal."),
		});
	}

	function handleCancel() {
		cancelSubscription.mutate(undefined, {
			onSuccess: () => {
				setCancelModalOpen(false);
				toast.success(
					"Subscription canceled. You'll keep access until the end of your billing period.",
				);
				queryClient.resetQueries({
					queryKey: ["billing", orgSlug, "subscription"],
				});
			},
			onError: (e) =>
				toast.error(
					e.message ?? "Could not cancel subscription. Please try again.",
				),
		});
	}

	const periodEnd = sub?.periodEnd
		? new Date(sub.periodEnd).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: null;

	return (
		<div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-6">
			<div>
				<h1 className="text-xl font-semibold">Billing</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your plan and invoices.
				</p>
			</div>

			{isPastDue && (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertDescription>
						Your last payment failed. Update your payment method to avoid
						service interruption.{" "}
						<button
							type="button"
							className="underline underline-offset-2"
							onClick={handlePortal}
						>
							Manage billing
						</button>
					</AlertDescription>
				</Alert>
			)}

			<PlanSummaryCard isPastDue={isPastDue} />

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

			{canCancel && (
				<FieldSet>
					<FieldLegend>Cancel your subscription</FieldLegend>
					<FieldDescription>
						Your subscription will remain active until{" "}
						{periodEnd ?? "the end of your billing period"}, then revert to the
						free plan. You can resubscribe at any time.
					</FieldDescription>
					<Button
						variant="outline"
						size="sm"
						className="max-w-min text-destructive hover:text-destructive"
						onClick={() => setCancelModalOpen(true)}
						disabled={cancelSubscription.isPending}
					>
						Cancel subscription
					</Button>
				</FieldSet>
			)}

			{sub && (
				<Dialog
					open={cancelModalOpen}
					onOpenChange={(v) => !v && setCancelModalOpen(false)}
				>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Cancel subscription?</DialogTitle>
							<DialogDescription>
								Your subscription will remain active until{" "}
								<strong>{periodEnd}</strong>, then revert to the free plan. You
								can resubscribe at any time.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setCancelModalOpen(false)}
								disabled={cancelSubscription.isPending}
							>
								Keep subscription
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={handleCancel}
								disabled={cancelSubscription.isPending}
							>
								{cancelSubscription.isPending
									? "Canceling…"
									: "Cancel subscription"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
