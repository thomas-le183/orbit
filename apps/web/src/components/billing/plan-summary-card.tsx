import { PLAN_METADATA, type SubscriptionPlan } from "@orbit/shared";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@orbit/ui/components/alert";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orbit/ui/components/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useActivateTrial,
  useBillingSummary,
  useChangePlan,
  useCheckout,
  useOrgSubscription,
} from "@/hooks/use-billing";

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
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
    subStatus != null &&
    ["active", "trialing", "past_due"].includes(subStatus);

  // Trial canceled mid-period (abandoned checkout) — still has future access
  const showConvertCanceled =
    subStatus === "canceled" && rawSub?.wasTrial === true;

  // Plan reverted to free after sub expired
  const showConvertTrial =
    !showConvertCanceled &&
    currentPlan === "free" &&
    rawSub?.wasTrial === true;
  const showResubscribe =
    currentPlan === "free" && rawSub?.wasTrial === false;

  const showUpgrade =
    !showConvertTrial &&
    !showResubscribe &&
    !showConvertCanceled &&
    nextTier != null &&
    subStatus !== "trialing" &&
    (isActive || subStatus == null);
  const showSwitchYearly = isActive && billingInterval === "monthly";

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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Switch to yearly billing?</DialogTitle>
          <DialogDescription>
            Your trial period will end and you will be charged{" "}
            {formatCurrency(monthlyPriceAnnual)} per user per month, billed
            annually. A pro-rata adjustment will be applied.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
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

export function PlanSummaryCard({ isPastDue = false }: { isPastDue?: boolean }) {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const queryClient = useQueryClient();
  const [switchYearlyModalOpen, setSwitchYearlyModalOpen] = useState(false);
  const [activateTrialModalOpen, setActivateTrialModalOpen] = useState(false);

  const { data, isLoading } = useOrgSubscription(orgSlug);
  const { data: summary, isLoading: isSummaryLoading } = useBillingSummary(orgSlug);
  const checkout = useCheckout(orgSlug);
  const changePlan = useChangePlan(orgSlug);
  const activateTrial = useActivateTrial(orgSlug);

  if (isLoading || isSummaryLoading || !data) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  }

  const sub = data.subscription ?? null;
  const currentPlan = (summary?.plan ?? sub?.plan ?? "free") as SubscriptionPlan;
  const meta = PLAN_METADATA[currentPlan];
  const billingInterval = summary?.billingInterval ?? null;
  const pricePerSeat = summary?.pricePerSeat ?? null;
  const memberCount = summary?.usage.members.current ?? data.memberCount ?? 0;
  const total = pricePerSeat != null ? pricePerSeat * memberCount : null;

  const isCanceled = sub?.status === "canceled";
  const isCancelingAtEnd = !!sub?.cancelAtPeriodEnd && !isCanceled;
  const isAccessEnding = isCanceled || isCancelingAtEnd;
  const statusInfo = sub
    ? (STATUS_BADGE[sub.status] ?? { label: sub.status, variant: "secondary" as const })
    : null;

  const daysRemaining =
    sub?.status === "trialing" && sub.periodEnd
      ? Math.max(0, Math.ceil((new Date(sub.periodEnd).getTime() - Date.now()) / 86_400_000))
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
    queryClient.invalidateQueries({ queryKey: ["billing", orgSlug, "subscription"] });
  }

  function confirmActivateTrial() {
    activateTrial.mutate(undefined, {
      onError: (e: { message?: string }) =>
        toast.error(e.message ?? "Could not activate subscription. Please try again."),
    });
  }

  function confirmSwitchYearly() {
    if (currentPlan !== "basic" && currentPlan !== "business") return;
    changePlan.mutate(
      { plan: currentPlan, interval: "yearly", subscriptionId: sub?.stripeSubscriptionId },
      {
        onSuccess: (data) => {
          if (data?.url) return;
          setSwitchYearlyModalOpen(false);
          toast.success("Switched to yearly billing.");
          invalidateSub();
        },
        onError: (e) =>
          toast.error(e.message ?? "Could not switch billing interval. Please try again."),
      },
    );
  }

  function handleSwitchYearly() {
    if (sub?.status === "trialing") {
      setSwitchYearlyModalOpen(true);
      return;
    }
    confirmSwitchYearly();
  }

  function handleUpgrade() {
    if (!nextTier) return;
    if (!sub) {
      checkout.mutate(
        { plan: nextTier, interval: "monthly" },
        {
          onError: (e) =>
            toast.error(e.message ?? "Could not start checkout. Please try again."),
        },
      );
    } else {
      changePlan.mutate(
        {
          plan: nextTier,
          interval: billingInterval ?? "monthly",
          subscriptionId: sub.stripeSubscriptionId,
        },
        {
          onSuccess: () => {
            toast.success("Plan upgraded successfully.");
            invalidateSub();
          },
          onError: (e) =>
            toast.error(e.message ?? "Could not upgrade plan. Please try again."),
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
          toast.error(e.message ?? "Could not start checkout. Please try again."),
      },
    );
  }

  function handleResubscribe() {
    if (!rawSub) return;
    checkout.mutate(
      { plan: rawSub.plan, interval: "monthly" },
      {
        onError: (e) =>
          toast.error(e.message ?? "Could not start checkout. Please try again."),
      },
    );
  }

  // Trial state renders a distinct banner instead of the summary card
  if (sub?.status === "trialing" || showConvertCanceled) {
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-violet-300 bg-linear-to-br from-violet-50 to-purple-50 dark:border-violet-700 dark:from-violet-950/40 dark:to-purple-950/40">
          <div className="flex items-center justify-between p-5">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-violet-600 dark:text-violet-400" />
                Trial
                {daysRemaining !== null && (
                  <span className="text-sm font-normal text-muted-foreground">
                    · {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {showConvertCanceled
                  ? "Business features active · checkout incomplete"
                  : "Business features active · no card on file"}
              </p>
            </div>
            <div className="flex gap-2">
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
              {showConvertCanceled && (
                <Button
                  size="sm"
                  onClick={handleConvertTrial}
                  disabled={activateTrial.isPending || checkout.isPending}
                >
                  Subscribe now
                </Button>
              )}
            </div>
          </div>
        </div>
        <ConfirmSwitchYearlyModal
          open={switchYearlyModalOpen}
          onClose={() => setSwitchYearlyModalOpen(false)}
          onConfirm={confirmSwitchYearly}
          isPending={changePlan.isPending}
          monthlyPriceAnnual={((summary?.pricePerSeat ?? meta.monthlyPriceUsd) * 10) / 12}
        />
        <Dialog
          open={activateTrialModalOpen}
          onOpenChange={(v) => !v && setActivateTrialModalOpen(false)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>End trial and subscribe?</DialogTitle>
              <DialogDescription>
                Your trial will be canceled immediately. You'll be taken to
                checkout to add a payment method and your{" "}
                <strong>{meta.label}</strong> subscription will start today.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivateTrialModalOpen(false)}
                disabled={activateTrial.isPending}
              >
                Keep trial
              </Button>
              <Button
                size="sm"
                onClick={confirmActivateTrial}
                disabled={activateTrial.isPending}
              >
                {activateTrial.isPending ? "Redirecting…" : "Subscribe now"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {/* Canceling / canceled alert */}
      {isAccessEnding && sub && (
        <Alert
          variant={isCanceled && !showConvertCanceled ? "destructive" : undefined}
          className={
            isCancelingAtEnd
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : showConvertCanceled
                ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                : undefined
          }
        >
          <AlertTriangle />
          <AlertTitle>
            {showConvertCanceled ? "Trial checkout incomplete" : `Subscription ${isCanceled ? "canceled" : "canceling"}`}
          </AlertTitle>
          <AlertDescription
            className={
              isCancelingAtEnd
                ? "text-amber-700 dark:text-amber-400"
                : showConvertCanceled
                  ? "text-violet-800 dark:text-violet-300"
                  : undefined
            }
          >
            {showConvertCanceled
              ? <>Your trial is still active until <strong>{sub.periodEnd ? formatDateShort(sub.periodEnd) : "end of period"}</strong>. Subscribe now to keep Business features after that.</>
              : isCancelingAtEnd
                ? <>Cancels on <strong>{sub.periodEnd ? formatDateShort(sub.periodEnd) : "end of period"}</strong>. You'll keep full access until then.</>
                : <>Canceled. Access continues until <strong>{sub.periodEnd ? formatDateShort(sub.periodEnd) : "end of period"}</strong>.</>
            }
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
              <Badge variant={statusInfo.variant} className="rounded-md text-xs">
                {statusInfo.label}
              </Badge>
            )}
          </div>
          {total != null && (
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
          )}
        </div>

        {/* Cost equation: X seats × $Y/seat = $Z/month */}
        {total != null && pricePerSeat != null && (
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
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Price per seat
            </div>
            <div className="mt-1 text-xl font-bold">
              {pricePerSeat != null ? formatCurrency(pricePerSeat) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {billingInterval ? `billed ${billingInterval}` : "—"}
            </div>
          </div>
          <div className="pl-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isAccessEnding ? "Access until" : "Renewal"}
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
        {(showUpgrade || showSwitchYearly || showConvertTrial || showResubscribe || showConvertCanceled) && (
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
                disabled={checkout.isPending || changePlan.isPending || isPastDue}
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
