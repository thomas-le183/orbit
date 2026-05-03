import { PLAN_METADATA } from "@orbit/shared";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@orbit/ui/components/alert";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogClose,
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
import { useParams } from "@tanstack/react-router";
import { AlertTriangle, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useChangePlan,
	useCheckout,
	useOrgSubscription,
	useStartTrial,
} from "@/hooks/use-billing";

function ConfirmSwitchYearlyModal({
	open,
	onClose,
	onConfirm,
	isPending,
	monthlyPriceAnnual,
}: {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	isPending: boolean;
	monthlyPriceAnnual: number;
}) {
	const formatted =
		monthlyPriceAnnual % 1 === 0
			? `$${monthlyPriceAnnual}`
			: `$${monthlyPriceAnnual.toFixed(2)}`;

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Switch to yearly billing?</DialogTitle>
					<DialogDescription>
						Your trial period will end and you will be charged {formatted} per
						user per month, billed annually. A pro-rata adjustment will be
						applied.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button size="sm" onClick={onConfirm} disabled={isPending}>
						{isPending ? "Switching…" : "Confirm switch"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function TrialModal({
	open,
	onClose,
	onStartTrial,
	onTryWithCard,
	isStartingTrial,
	isCheckingOut,
}: {
	open: boolean;
	onClose: () => void;
	onStartTrial: () => void;
	onTryWithCard: () => void;
	isStartingTrial: boolean;
	isCheckingOut: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Zap className="size-5 text-primary" />
						Try Business for free
					</DialogTitle>
					<DialogDescription>
						Experience all Business features before committing. Choose the
						option that works best for you.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-3 py-2">
					<button
						type="button"
						onClick={onStartTrial}
						disabled={isStartingTrial || isCheckingOut}
						className="group flex flex-col gap-1 rounded-lg border border-border-strong bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
					>
						<span className="font-medium">7-day free trial</span>
						<span className="text-sm text-muted-foreground">
							No credit card required. Full Business access for 7 days, then
							automatically reverts to Hobby.
						</span>
					</button>

					<button
						type="button"
						onClick={onTryWithCard}
						disabled={isStartingTrial || isCheckingOut}
						className="group flex flex-col gap-1 rounded-lg border border-border-strong bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
					>
						<span className="font-medium">30-day free trial</span>
						<span className="text-sm text-muted-foreground">
							Credit card required. 30 days free, then billed monthly. Cancel
							anytime before the trial ends.
						</span>
					</button>
				</div>

				<DialogFooter>
					<DialogClose>
						<Button variant="ghost" size="sm">
							Maybe later
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

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

export function SubscriptionSection({
	isPastDue = false,
}: {
	isPastDue?: boolean;
}) {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const queryClient = useQueryClient();
	const [trialModalOpen, setTrialModalOpen] = useState(false);
	const [switchYearlyModalOpen, setSwitchYearlyModalOpen] = useState(false);
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

	const isCanceled = sub?.status === "canceled";
	const isCancelingAtEnd = sub?.cancelAtPeriodEnd && !isCanceled;
	const isAccessEnding = isCanceled || isCancelingAtEnd;
	const interval = sub
		? getBillingInterval(sub.currentPeriodStart, sub.currentPeriodEnd)
		: null;
	const renewalLabel = isAccessEnding ? "Access until" : "Renewal date";

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
	const showSwitchYearly = isActive && interval === "monthly";
	const showSubscribeNow = sub?.status === "trialing";
	const showTrialCta = data.trialEligible && !sub && !showSubscribeNow;
	const showUpgrade =
		nextTier != null &&
		!showSubscribeNow &&
		!showTrialCta &&
		(isActive || !sub);

	function invalidateSub() {
		queryClient.resetQueries({
			queryKey: ["billing", orgSlug, "subscription"],
		});
	}

	function handleSubscribeNow() {
		if (currentPlan !== "basic" && currentPlan !== "business") return;
		changePlan.mutate(
			{ plan: currentPlan, interval: "monthly", endTrial: true },
			{
				onSuccess: (data) => {
					if (data.url) return; // hook redirects
					toast.success("Plan activated successfully.");
					invalidateSub();
				},
				onError: (e: { message?: string }) =>
					toast.error(
						e.message ?? "Could not activate plan. Please try again.",
					),
			},
		);
	}

	function handleSwitchYearly() {
		if (currentPlan !== "basic" && currentPlan !== "business") return;
		if (sub?.status === "trialing") {
			setSwitchYearlyModalOpen(true);
			return;
		}
		confirmSwitchYearly();
	}

	function confirmSwitchYearly() {
		if (currentPlan !== "basic" && currentPlan !== "business") return;
		changePlan.mutate(
			{
				plan: currentPlan,
				interval: "yearly",
				endTrial: sub?.status === "trialing",
			},
			{
				onSuccess: (data) => {
					if (data.url) return; // hook redirects
					setSwitchYearlyModalOpen(false);
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
				{ plan: nextTier, interval: interval ?? "monthly" },
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

	function handleTryBusinessTrial() {
		checkout.mutate(
			{ plan: "business", interval: "monthly" },
			{
				onError: (e) =>
					toast.error(
						e.message ?? "Could not start checkout. Please try again.",
					),
			},
		);
	}

	function handleStartTrial() {
		startTrial.mutate(undefined, {
			onSuccess: () => {
				setTrialModalOpen(false);
				toast.success("Your 7-day Business trial has started!");
				invalidateSub();
			},
			onError: (e) =>
				toast.error(e.message ?? "Could not start trial. Please try again."),
		});
	}

	return (
		<>
			<FieldSet>
				<FieldLegend>Subscription</FieldLegend>
				<FieldDescription>About my subscription</FieldDescription>
				{isAccessEnding && sub && (
					<Alert
						variant={isCanceled ? "destructive" : undefined}
						className={
							isCancelingAtEnd
								? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
								: undefined
						}
					>
						<AlertTriangle />
						<AlertTitle>Subscription canceled</AlertTitle>
						<AlertDescription
							className={
								isCancelingAtEnd
									? "text-amber-700 dark:text-amber-400"
									: undefined
							}
						>
							{isCancelingAtEnd
								? "Cancels on"
								: "Canceled. Access continues until"}{" "}
							<strong>{formatDate(sub.currentPeriodEnd)}</strong>
							{isCancelingAtEnd && ". You'll keep full access until then."}
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
				{(showSubscribeNow ||
					showSwitchYearly ||
					showUpgrade ||
					showTrialCta) && (
					<div className="flex flex-wrap gap-2">
						{showSubscribeNow && (
							<Button
								size="sm"
								variant="outline"
								onClick={handleSubscribeNow}
								disabled={changePlan.isPending || isPastDue}
							>
								Subscribe now
							</Button>
						)}
						{showSwitchYearly && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleSwitchYearly}
								disabled={changePlan.isPending || isPastDue}
							>
								Switch to yearly
							</Button>
						)}
						{showUpgrade && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleUpgrade}
								disabled={
									checkout.isPending || changePlan.isPending || isPastDue
								}
							>
								Upgrade to {PLAN_METADATA[nextTier].label}
							</Button>
						)}
						{showTrialCta && (
							<Button
								size="sm"
								onClick={() => setTrialModalOpen(true)}
								disabled={isPastDue}
							>
								<Zap />
								Try Business free
							</Button>
						)}
					</div>
				)}
			</FieldSet>

			<TrialModal
				open={trialModalOpen}
				onClose={() => setTrialModalOpen(false)}
				onStartTrial={handleStartTrial}
				onTryWithCard={handleTryBusinessTrial}
				isStartingTrial={startTrial.isPending}
				isCheckingOut={checkout.isPending}
			/>
			<ConfirmSwitchYearlyModal
				open={switchYearlyModalOpen}
				onClose={() => setSwitchYearlyModalOpen(false)}
				onConfirm={confirmSwitchYearly}
				isPending={changePlan.isPending}
				monthlyPriceAnnual={(meta.monthlyPriceUsd * 10) / 12}
			/>
		</>
	);
}
