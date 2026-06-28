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
import { Skeleton } from "@orbit/ui/components/skeleton";
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
import { PricingTable } from "@/components/billing/pricing-table";
import { loadOrgRole } from "@/hooks/use-auth";
import {
	useActivateTrial,
	useBillingSummary,
	useCancelSubscription,
	useChangePlan,
	useCheckout,
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
		setup_session: search.setup_session as string | undefined,
	}),
	component: BillingPage,
});

function BillingPage() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { checkout: checkoutResult, setup_session: setupSession } = useSearch({
		from: "/_workspace/$orgSlug/settings/billing",
	});
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data, isLoading } = useOrgSubscription(orgSlug);
	const { data: summary } = useBillingSummary(orgSlug);
	const portal = usePortal(orgSlug);
	const activateTrial = useActivateTrial(orgSlug);
	const checkout = useCheckout(orgSlug);
	const changePlan = useChangePlan(orgSlug);
	const cancelSubscription = useCancelSubscription(orgSlug);
	const [cancelModalOpen, setCancelModalOpen] = useState(false);
	const sub = data?.subscription;
	const currentPlan = (sub?.plan ??
		summary?.plan ??
		"free") as import("@orbit/shared").SubscriptionPlan;
	const hasActiveSubscription =
		sub != null && ["active", "trialing", "past_due"].includes(sub.status);
	const isPastDue = sub?.status === "past_due";
	const isTrialing = sub?.status === "trialing";
	const canCancel =
		sub != null &&
		["active", "trialing", "past_due"].includes(sub.status) &&
		!sub.cancelAtPeriodEnd;

	useEffect(() => {
		if (!setupSession) return;
		activateTrial.mutate(
			{ sessionId: setupSession },
			{
				onSuccess: () => {
					toast.success(
						"Payment method saved. You'll be charged when your trial ends.",
					);
					void queryClient.invalidateQueries({
						queryKey: ["billing", orgSlug, "subscription"],
					});
					navigate({
						to: ".",
						search: (prev) => ({
							...prev,
							checkout: undefined,
							setup_session: undefined,
						}),
					});
				},
				onError: () =>
					toast.error("Could not save payment method. Please try again."),
			},
		);
	}, [setupSession, activateTrial.mutate, navigate, queryClient, orgSlug]);

	useEffect(() => {
		if (!checkoutResult || setupSession) return;
		if (checkoutResult === "success") {
			toast.success("Subscription activated! Welcome to your new plan.");
			void queryClient.invalidateQueries({
				queryKey: ["billing", orgSlug, "subscription"],
			});
		} else if (checkoutResult === "canceled") {
			toast.info("Checkout canceled. No changes were made.");
		}
		navigate({ to: ".", search: (prev) => ({ ...prev, checkout: undefined }) });
	}, [checkoutResult, setupSession, navigate, queryClient, orgSlug]);

	function handlePortal() {
		portal.mutate(undefined, {
			onError: () => toast.error("Could not open billing portal."),
		});
	}

	function handleSelectPlan(
		plan: import("@orbit/shared").SubscriptionPlan,
		interval: "monthly" | "yearly",
	) {
		if (hasActiveSubscription && sub?.stripeSubscriptionId) {
			changePlan.mutate(
				{
					plan,
					interval,
					subscriptionId: sub.stripeSubscriptionId ?? undefined,
				},
				{
					onSuccess: () => toast.success("Plan updated successfully."),
					onError: (e) =>
						toast.error(
							e.message ?? "Could not switch plan. Please try again.",
						),
				},
			);
		} else {
			checkout.mutate(
				{ plan, interval },
				{
					onError: (e) =>
						toast.error(
							e.message ?? "Could not start checkout. Please try again.",
						),
				},
			);
		}
	}

	function handleCancel() {
		cancelSubscription.mutate(undefined, {
			onSuccess: () => {
				setCancelModalOpen(false);
				toast.success(
					isTrialing
						? "Trial ending. You'll keep Business access until the trial expires."
						: "Subscription canceled. You'll keep access until the end of your billing period.",
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
		<div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-6">
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
				<FieldLegend>Plans</FieldLegend>
				<FieldDescription>
					{hasActiveSubscription
						? "Upgrade or downgrade your plan at any time."
						: "Choose a plan to get started."}
				</FieldDescription>
				<PricingTable
					currentPlan={currentPlan}
					hasActiveSubscription={hasActiveSubscription}
					isPending={checkout.isPending || changePlan.isPending}
					onSelectPlan={handleSelectPlan}
				/>
			</FieldSet>

			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-4 w-72" />
					<Skeleton className="h-8 w-44" />
				</div>
			) : (
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
			)}

			{isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-4 w-44" />
					<Skeleton className="h-4 w-80" />
					<Skeleton className="h-8 w-36" />
				</div>
			) : canCancel ? (
				<FieldSet>
					<FieldLegend>
						{isTrialing ? "End your trial" : "Cancel your subscription"}
					</FieldLegend>
					<FieldDescription>
						{isTrialing
							? `Your trial will be marked for cancellation. You'll keep Business access until ${periodEnd ?? "the trial ends"}, then revert to the free plan.`
							: `Your subscription will remain active until ${periodEnd ?? "the end of your billing period"}, then revert to the free plan. You can resubscribe at any time.`}
					</FieldDescription>
					<Button
						variant="outline"
						size="sm"
						className="max-w-min text-destructive hover:text-destructive"
						onClick={() => setCancelModalOpen(true)}
						disabled={cancelSubscription.isPending}
					>
						{isTrialing ? "End trial" : "Cancel subscription"}
					</Button>
				</FieldSet>
			) : null}

			{sub && (
				<Dialog
					open={cancelModalOpen}
					onOpenChange={(v) => !v && setCancelModalOpen(false)}
				>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>
								{isTrialing ? "End trial?" : "Cancel subscription?"}
							</DialogTitle>
							<DialogDescription>
								{isTrialing ? (
									<>
										Your trial will remain active until{" "}
										<strong>{periodEnd}</strong>. After that you'll revert to
										the free plan.
									</>
								) : (
									<>
										Your subscription will remain active until{" "}
										<strong>{periodEnd}</strong>, then revert to the free plan.
										You can resubscribe at any time.
									</>
								)}
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setCancelModalOpen(false)}
								disabled={cancelSubscription.isPending}
							>
								{isTrialing ? "Keep trial" : "Keep subscription"}
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={handleCancel}
								disabled={cancelSubscription.isPending}
							>
								{cancelSubscription.isPending
									? "Canceling…"
									: isTrialing
										? "End trial"
										: "Cancel subscription"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
