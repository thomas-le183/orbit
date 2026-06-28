import { PLAN_METADATA, type SubscriptionPlan } from "@orbit/shared";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@orbit/ui/components/alert";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { AlertTriangle, Crown } from "lucide-react";
import { toast } from "sonner";
import {
	useBillingSummary,
	useChangePlan,
	useCheckout,
	useConvertTrial,
	useOrgSubscription,
	usePortal,
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

const NEXT_TIER: Partial<Record<SubscriptionPlan, "basic" | "business">> = {
	free: "basic",
	basic: "business",
};

export function formatCurrency(amount: number): string {
	const rounded = Math.round(amount * 100) / 100;
	return rounded % 1 === 0 ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

export function formatDateShort(date: Date | string): string {
	return new Date(date).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function deriveShowActions({
	subStatus,
	currentPlan,
	billingInterval,
	rawSub,
}: {
	subStatus: string | null;
	currentPlan: string;
	billingInterval: "monthly" | "yearly" | null;
	rawSub: { plan: SubscriptionPlan; wasTrial: boolean } | null;
}) {
	const nextTier = NEXT_TIER[currentPlan as SubscriptionPlan] ?? null;
	const isActive =
		subStatus != null && ["active", "trialing", "past_due"].includes(subStatus);

	// Trial canceled mid-period (abandoned checkout) — still has future access
	const showConvertCanceled =
		subStatus === "canceled" && rawSub?.wasTrial === true;

	// Plan reverted to free after sub expired
	const showConvertTrial =
		!showConvertCanceled && currentPlan === "free" && rawSub?.wasTrial === true;
	const showResubscribe = currentPlan === "free" && rawSub?.wasTrial === false;

	const showUpgrade =
		!showConvertTrial &&
		!showResubscribe &&
		!showConvertCanceled &&
		nextTier != null &&
		subStatus !== "trialing" &&
		(isActive || subStatus == null);
	const showSwitchYearly =
		isActive && subStatus !== "past_due" && billingInterval === "monthly";

	return {
		showUpgrade,
		showSwitchYearly,
		showConvertTrial,
		showConvertCanceled,
		showResubscribe,
		nextTier,
		rawSub,
	};
}

export function PlanSummaryCard({
	isPastDue = false,
}: {
	isPastDue?: boolean;
}) {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const queryClient = useQueryClient();

	const { data, isLoading } = useOrgSubscription(orgSlug);
	const { data: summary, isLoading: isSummaryLoading } =
		useBillingSummary(orgSlug);
	const checkout = useCheckout(orgSlug);
	const convertTrial = useConvertTrial(orgSlug);
	const changePlan = useChangePlan(orgSlug);
	const portal = usePortal(orgSlug);

	if (isLoading || isSummaryLoading || !data) {
		return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
	}

	const sub = data.subscription ?? null;
	// Display plan: the plan the user is subscribed to (e.g. "business" even when past_due)
	// Access plan (summary.plan): "free" for past_due/unpaid — used for feature gating only
	const currentPlan = (sub?.plan ??
		summary?.plan ??
		"free") as SubscriptionPlan;
	const meta = PLAN_METADATA[currentPlan];
	const billingInterval = summary?.billingInterval ?? null;
	const pricePerSeat = summary?.pricePerSeat ?? null;
	const memberCount = summary?.usage.members.current ?? data.memberCount ?? 0;
	const total = pricePerSeat != null ? pricePerSeat * memberCount : null;

	const isCanceled = sub?.status === "canceled";
	const isCancelingAtEnd = !!sub?.cancelAtPeriodEnd && !isCanceled;
	const isAccessEnding = isCanceled || isCancelingAtEnd;
	const statusInfo = sub
		? (STATUS_BADGE[sub.status] ?? {
				label: sub.status,
				variant: "secondary" as const,
			})
		: null;

	const daysRemaining =
		sub?.status === "trialing" && sub.periodEnd
			? Math.max(
					0,
					Math.ceil(
						(new Date(sub.periodEnd).getTime() - Date.now()) / 86_400_000,
					),
				)
			: null;

	const {
		showUpgrade,
		showSwitchYearly,
		showConvertTrial,
		showConvertCanceled,
		showResubscribe,
		nextTier,
		rawSub,
	} = deriveShowActions({
		subStatus: sub?.status ?? null,
		currentPlan,
		billingInterval,
		rawSub: summary?.subscription ?? null,
	});

	function invalidateSub() {
		queryClient.invalidateQueries({
			queryKey: ["billing", orgSlug, "subscription"],
		});
	}

	function confirmSwitchYearly() {
		if (currentPlan !== "basic" && currentPlan !== "business") return;
		changePlan.mutate(
			{
				plan: currentPlan,
				interval: "yearly",
				subscriptionId: sub?.stripeSubscriptionId ?? undefined,
			},
			{
				onSuccess: (data) => {
					if (data?.url) return;
					toast.success("Switched to yearly billing.");
					invalidateSub();
				},
				onError: (e) =>
					toast.error(
						e.message ?? "Could not switch billing interval. Please try again.",
					),
			},
		);
	}

	function handleSwitchYearly() {
		confirmSwitchYearly();
	}

	function handleUpgrade() {
		if (!nextTier) return;
		if (!sub) {
			checkout.mutate(
				{ plan: nextTier, interval: "monthly" },
				{
					onError: (e) =>
						toast.error(
							e.message ?? "Could not start checkout. Please try again.",
						),
				},
			);
		} else {
			changePlan.mutate(
				{
					plan: nextTier,
					interval: billingInterval ?? "monthly",
					subscriptionId: sub.stripeSubscriptionId ?? undefined,
				},
				{
					onSuccess: () => {
						toast.success("Plan upgraded successfully.");
						invalidateSub();
					},
					onError: (e) =>
						toast.error(
							e.message ?? "Could not upgrade plan. Please try again.",
						),
				},
			);
		}
	}

	function handleConvertTrial() {
		if (!rawSub) return;
		checkout.mutate(
			{ plan: rawSub.plan, interval: "monthly" },
			{
				onError: (e) =>
					toast.error(
						e.message ?? "Could not start checkout. Please try again.",
					),
			},
		);
	}

	function handleResubscribe() {
		if (!rawSub) return;
		checkout.mutate(
			{ plan: rawSub.plan, interval: "monthly" },
			{
				onError: (e) =>
					toast.error(
						e.message ?? "Could not start checkout. Please try again.",
					),
			},
		);
	}

	return (
		<>
			{/* Trial countdown banner */}
			{sub?.status === "trialing" && (
				<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
					<div className="flex items-center gap-3">
						<Crown className="size-4 shrink-0 text-(--color-amber-foreground)" />
						<div>
							<span className="text-sm font-semibold">
								Business trial ends
								{daysRemaining !== null
									? ` in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`
									: ""}
							</span>
							{sub.periodEnd && (
								<div className="text-xs text-muted-foreground">
									{formatDateShort(sub.periodEnd)} · All Business features
									active
								</div>
							)}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() =>
								portal.mutate(undefined, {
									onError: () => toast.error("Could not open billing portal."),
								})
							}
							disabled={portal.isPending}
						>
							Learn more
						</Button>
						<Button
							size="sm"
							onClick={() =>
								convertTrial.mutate(
									{
										successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success&setup_session={CHECKOUT_SESSION_ID}`,
										cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
									},
									{
										onError: (e) =>
											toast.error(
												e.message ??
													"Could not start checkout. Please try again.",
											),
									},
								)
							}
							disabled={convertTrial.isPending || isPastDue}
						>
							Subscribe now
						</Button>
					</div>
				</div>
			)}

			{/* Canceling / canceled alert */}
			{isAccessEnding && sub && (
				<Alert
					variant={
						isCanceled && !showConvertCanceled ? "destructive" : undefined
					}
					className={
						isCancelingAtEnd
							? "border-(--color-amber-border) bg-(--color-amber-bg) text-(--color-amber-foreground)"
							: showConvertCanceled
								? "border-(--color-violet-border) bg-(--color-violet-bg) text-(--color-violet-foreground)"
								: undefined
					}
				>
					<AlertTriangle />
					<AlertTitle>
						{showConvertCanceled
							? "Trial checkout incomplete"
							: `Subscription ${isCanceled ? "canceled" : "canceling"}`}
					</AlertTitle>
					<AlertDescription
						className={
							isCancelingAtEnd
								? "text-(--color-amber-foreground)"
								: showConvertCanceled
									? "text-(--color-violet-foreground)"
									: undefined
						}
					>
						{showConvertCanceled ? (
							<>
								Your trial is still active until{" "}
								<strong>
									{sub.periodEnd
										? formatDateShort(sub.periodEnd)
										: "end of period"}
								</strong>
								. Subscribe now to keep Business features after that.
							</>
						) : isCancelingAtEnd ? (
							<>
								Cancels on{" "}
								<strong>
									{sub.periodEnd
										? formatDateShort(sub.periodEnd)
										: "end of period"}
								</strong>
								. You'll keep full access until then.
							</>
						) : (
							<>
								Canceled. Access continues until{" "}
								<strong>
									{sub.periodEnd
										? formatDateShort(sub.periodEnd)
										: "end of period"}
								</strong>
								.
							</>
						)}
					</AlertDescription>
				</Alert>
			)}

			{/* Summary card */}
			<div className="overflow-hidden rounded-xl border">
				{/* Header: plan name + status | total + next invoice */}
				<div className="flex items-start justify-between border-b p-5">
					<div className="flex items-center gap-2">
						<span className="text-lg font-bold">{meta.label}</span>
						{statusInfo && (
							<Badge
								variant={statusInfo.variant}
								className="rounded-md text-xs"
							>
								{statusInfo.label}
							</Badge>
						)}
					</div>
					{sub?.status === "trialing" ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								portal.mutate(undefined, {
									onError: () => toast.error("Could not open billing portal."),
								})
							}
							disabled={portal.isPending}
						>
							Manage subscription
						</Button>
					) : total != null ? (
						<div className="text-right">
							<div className="text-2xl font-extrabold">
								{formatCurrency(total)}
								<span className="text-sm font-normal text-muted-foreground">
									/month
								</span>
							</div>
							{sub?.periodEnd && (
								<div className="text-xs text-muted-foreground">
									Next invoice {formatDateShort(sub.periodEnd)}
								</div>
							)}
						</div>
					) : null}
				</div>

				{/* Cost equation: X seats × $Y/seat = $Z/month */}
				{sub?.status !== "trialing" &&
					total != null &&
					pricePerSeat != null && (
						<div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3 text-sm">
							<span className="rounded border bg-card px-2 py-0.5 font-semibold">
								{memberCount} seats
							</span>
							<span className="text-muted-foreground">×</span>
							<span className="rounded border bg-card px-2 py-0.5 font-semibold">
								{formatCurrency(pricePerSeat)} / seat
							</span>
							<span className="text-muted-foreground">=</span>
							<span className="font-bold">{formatCurrency(total)} / month</span>
							{billingInterval && (
								<span className="ml-auto rounded border bg-card px-2 py-0.5 text-xs capitalize text-muted-foreground">
									{billingInterval} billing
								</span>
							)}
						</div>
					)}

				{/* Stats: seats | price/seat | renewal */}
				<div className="grid grid-cols-3 divide-x px-5 py-4">
					<div className="pr-4">
						<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Seats used
						</div>
						<div className="mt-1 text-xl font-bold">{memberCount}</div>
						<div className="text-xs text-muted-foreground">
							members in workspace
						</div>
					</div>
					<div className="px-4">
						{sub?.status === "trialing" ? (
							<>
								<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Unused seats
								</div>
								<div className="mt-1 text-xl font-bold">
									{sub.seats != null
										? Math.max(0, sub.seats - memberCount)
										: "—"}
								</div>
								<div className="text-xs text-muted-foreground">
									{sub.seats != null
										? `${sub.seats} paid · ${memberCount} active`
										: "—"}
								</div>
							</>
						) : (
							<>
								<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Price per seat
								</div>
								<div className="mt-1 text-xl font-bold">
									{pricePerSeat != null ? formatCurrency(pricePerSeat) : "—"}
								</div>
								<div className="text-xs text-muted-foreground">
									{billingInterval ? `billed ${billingInterval}` : "—"}
								</div>
							</>
						)}
					</div>
					<div className="pl-4">
						<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{sub?.status === "trialing"
								? "Trial ends"
								: isAccessEnding
									? "Access until"
									: "Renewal"}
						</div>
						<div className="mt-1 text-xl font-bold">
							{sub?.periodEnd
								? new Date(sub.periodEnd).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
									})
								: "—"}
						</div>
						<div className="text-xs text-muted-foreground">
							{sub?.periodEnd ? new Date(sub.periodEnd).getFullYear() : ""}
						</div>
					</div>
				</div>

				{/* Actions */}
				{sub?.status !== "trialing" &&
					(showUpgrade ||
						showSwitchYearly ||
						showConvertTrial ||
						showResubscribe ||
						showConvertCanceled) && (
						<div className="flex flex-wrap gap-2 border-t px-5 py-3">
							{showConvertCanceled && rawSub && (
								<Button
									size="sm"
									onClick={handleConvertTrial}
									disabled={checkout.isPending}
								>
									Subscribe to {PLAN_METADATA[rawSub.plan].label}
								</Button>
							)}
							{showConvertTrial && rawSub && (
								<Button
									size="sm"
									onClick={handleConvertTrial}
									disabled={checkout.isPending}
								>
									Subscribe to {PLAN_METADATA[rawSub.plan].label}
								</Button>
							)}
							{showResubscribe && rawSub && (
								<Button
									size="sm"
									onClick={handleResubscribe}
									disabled={checkout.isPending}
								>
									Resubscribe to {PLAN_METADATA[rawSub.plan].label}
								</Button>
							)}
							{showUpgrade && nextTier && (
								<Button
									size="sm"
									onClick={handleUpgrade}
									disabled={
										checkout.isPending || changePlan.isPending || isPastDue
									}
								>
									Upgrade to {PLAN_METADATA[nextTier].label}
								</Button>
							)}
							{showSwitchYearly && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleSwitchYearly}
									disabled={changePlan.isPending || isPastDue}
								>
									Switch to yearly · save 17%
								</Button>
							)}
						</div>
					)}
			</div>
		</>
	);
}
