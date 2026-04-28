import { PLAN_METADATA } from "@orbit/shared";
import { Alert, AlertDescription } from "@orbit/ui/components/alert";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@orbit/ui/components/field";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
	useChangePlan,
	useCheckout,
	useOrgSubscription,
	useStartTrial,
} from "@/hooks/use-billing";

const STATUS_BADGE: Record<
	string,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
	}
> = {
	active: { label: "Active", variant: "default" },
	trialing: { label: "Trial", variant: "secondary" },
	past_due: { label: "Past due", variant: "destructive" },
	canceled: { label: "Canceled", variant: "destructive" },
	unpaid: { label: "Unpaid", variant: "destructive" },
};

const NEXT_TIER: Partial<Record<string, "basic" | "business">> = {
	free: "basic",
	basic: "business",
};

function formatDate(date: Date | string) {
	return new Date(date).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getBillingInterval(
	start: Date | string,
	end: Date | string,
): "monthly" | "yearly" {
	const days =
		(new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;
	return days > 60 ? "yearly" : "monthly";
}

export function SubscriptionSection() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const queryClient = useQueryClient();
	const { data, isLoading } = useOrgSubscription(orgSlug);
	const checkout = useCheckout(orgSlug);
	const changePlan = useChangePlan(orgSlug);
	const startTrial = useStartTrial(orgSlug);

	if (isLoading || !data) {
		return <div className="h-36 animate-pulse rounded-lg bg-muted" />;
	}

	const currentPlan = data.plan;
	const meta = PLAN_METADATA[currentPlan];
	const sub = data.subscription;
	const activeStatuses = new Set(["active", "trialing", "past_due"]);
	const isActive = sub != null && activeStatuses.has(sub.status);

	const statusInfo = sub
		? (STATUS_BADGE[sub.status] ?? {
				label: sub.status,
				variant: "secondary" as const,
			})
		: null;

	const isPastDue = sub?.status === "past_due";
	const isCancelingAtEnd = sub?.cancelAtPeriodEnd && sub.status !== "canceled";
	const isCanceled = sub?.status === "canceled";
	const interval = sub
		? getBillingInterval(sub.currentPeriodStart, sub.currentPeriodEnd)
		: null;
	const renewalLabel =
		isCanceled || isCancelingAtEnd ? "Access until" : "Renews";

	const daysRemaining =
		sub?.status === "trialing"
			? Math.max(
					0,
					Math.ceil(
						(new Date(sub.currentPeriodEnd).getTime() - Date.now()) /
							86_400_000,
					),
				)
			: null;

	const nextTier = NEXT_TIER[currentPlan];
	const showSubscribeNow = sub?.status === "trialing";
	const showSwitchYearly = isActive && interval === "monthly";
	const showUpgrade = nextTier != null && !showSubscribeNow && (isActive || !sub);

	function invalidateSub() {
		queryClient.invalidateQueries({
			queryKey: ["billing", orgSlug, "subscription"],
		});
	}

	function handleSubscribeNow() {
		checkout.mutate(
			{ plan: currentPlan as "basic" | "business", interval: interval ?? "monthly" },
			{
				onError: () =>
					toast.error("Could not start checkout. Please try again."),
			},
		);
	}

	function handleSwitchYearly() {
		if (currentPlan !== "basic" && currentPlan !== "business") return;
		changePlan.mutate(
			{ plan: currentPlan, interval: "yearly" },
			{
				onSuccess: () => {
					toast.success("Switched to yearly billing.");
					invalidateSub();
				},
				onError: () =>
					toast.error("Could not switch billing interval. Please try again."),
			},
		);
	}

	function handleUpgrade() {
		if (!nextTier) return;
		if (!sub) {
			checkout.mutate(
				{ plan: nextTier, interval: "monthly" },
				{
					onError: () =>
						toast.error("Could not start checkout. Please try again."),
				},
			);
		} else {
			changePlan.mutate(
				{ plan: nextTier, interval: interval ?? "monthly" },
				{
					onSuccess: () => {
						toast.success("Plan upgraded successfully.");
						invalidateSub();
					},
					onError: () =>
						toast.error("Could not upgrade plan. Please try again."),
				},
			);
		}
	}

	function handleStartTrial() {
		startTrial.mutate(undefined, {
			onSuccess: () => {
				toast.success("Your 7-day Business trial has started!");
				invalidateSub();
			},
			onError: () => toast.error("Could not start trial. Please try again."),
		});
	}

	return (
		<FieldSet>
			<FieldLegend>Subscription</FieldLegend>
			<FieldDescription>About my subscription</FieldDescription>
			{isPastDue && (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertDescription>
						Your last payment failed. Please update your payment method to avoid
						service interruption.
					</AlertDescription>
				</Alert>
			)}

			{isCancelingAtEnd && (
				<Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
					<AlertTriangle />
					<AlertDescription className="text-amber-700 dark:text-amber-400">
						Subscription cancels on{" "}
						<strong>{formatDate(sub.currentPeriodEnd)}</strong>. You'll keep
						full access until then.
					</AlertDescription>
				</Alert>
			)}

			{isCanceled && (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertDescription>
						Subscription canceled. Access continues until{" "}
						<strong>{formatDate(sub.currentPeriodEnd)}</strong>.
					</AlertDescription>
				</Alert>
			)}

			{/* Card */}
			<div className="rounded-lg border bg-card">
				<div className="grid grid-cols-[auto_1fr] items-center gap-x-8 gap-y-3 p-6 text-sm">
					<span className="text-muted-foreground">Plan</span>
					<span className="flex items-center gap-2 font-medium">
						<Badge className="rounded-md text-sm">{meta.label}</Badge>
						{sub?.status === "trialing" && statusInfo && (
							<Badge variant={statusInfo.variant} className="text-xs">
								{statusInfo.label}
							</Badge>
						)}
					</span>

					{interval && (
						<>
							<span className="text-muted-foreground">Billing</span>
							<span className="capitalize">{interval}</span>
						</>
					)}

					{sub && (
						<>
							<span className="text-muted-foreground">{renewalLabel}</span>
							<span>{formatDate(sub.currentPeriodEnd)}</span>
						</>
					)}

					<span className="text-muted-foreground">Seats</span>
					<span>
						{data.usage.members.current}
						{data.usage.members.limit !== -1 && (
							<span className="text-muted-foreground">
								{" "}
								/ {data.usage.members.limit}
							</span>
						)}
					</span>

					{daysRemaining !== null && (
						<>
							<span className="text-muted-foreground">Trial ends</span>
							<span>
								{daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
							</span>
						</>
					)}
				</div>
			</div>

			{/* Actions */}
			{(showSubscribeNow || showSwitchYearly || showUpgrade) && (
				<div className="flex flex-wrap gap-2">
					{showSubscribeNow && (
						<Button
							size="sm"
							onClick={handleSubscribeNow}
							disabled={checkout.isPending}
						>
							Subscribe now
						</Button>
					)}
					{showSwitchYearly && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleSwitchYearly}
							disabled={changePlan.isPending}
						>
							Switch to yearly
						</Button>
					)}
					{showUpgrade && (
						<>
							{nextTier === "business" && data.trialEligible && !sub ? (
								<>
									<Button
										size="sm"
										onClick={handleStartTrial}
										disabled={startTrial.isPending}
									>
										Start 7-day free trial
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={handleUpgrade}
										disabled={checkout.isPending || changePlan.isPending}
									>
										Try 30 days free
									</Button>
								</>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={handleUpgrade}
									disabled={checkout.isPending || changePlan.isPending}
								>
									Upgrade to {PLAN_METADATA[nextTier].label}
								</Button>
							)}
						</>
					)}
				</div>
			)}
		</FieldSet>
	);
}
