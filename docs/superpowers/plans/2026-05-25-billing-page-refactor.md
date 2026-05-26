# Billing Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic billing UI with a per-seat-aware summary card that shows `seats × price = total`, fixes two data bugs, and consolidates to a single data source.

**Architecture:** Three isolated changes — fix the data hook bug, build the new `PlanSummaryCard` component, then swap it into the page. Old `subscription-section.tsx` is deleted at the end. No new API endpoints needed.

**Tech Stack:** React 19, TanStack Router, TanStack Query, shadcn/ui (`@orbit/ui`), Tailwind CSS v4, Vitest + Testing Library, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/web/src/hooks/use-billing.tsx` | Fix `past_due` bug in `useOrgSubscription` |
| Create | `apps/web/src/components/billing/plan-summary-card.tsx` | New summary card component — all subscription states |
| Create | `apps/web/src/components/billing/plan-summary-card.test.tsx` | Unit tests for pure utility functions |
| Modify | `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx` | Swap `SubscriptionSection` → `PlanSummaryCard` |
| Delete | `apps/web/src/components/billing/subscription-section.tsx` | Replaced by `PlanSummaryCard` |

---

## Task 1: Fix `useOrgSubscription` to include `past_due` subscriptions

**Files:**
- Modify: `apps/web/src/hooks/use-billing.tsx:60-63`

Currently the hook only returns `active` or `trialing` subscriptions. This means past-due orgs get `sub = null`, so `isPastDue` is always `false` and the past-due alert never renders.

- [ ] **Step 1: Open `apps/web/src/hooks/use-billing.tsx` and find line 60-63:**

```typescript
const activeSubscription =
  subsResult.data?.find(
    (sub) => sub.status === "active" || sub.status === "trialing",
  ) ?? null;
```

- [ ] **Step 2: Replace with:**

```typescript
const activeSubscription =
  subsResult.data?.find((sub) =>
    ["active", "trialing", "past_due"].includes(sub.status),
  ) ?? null;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from repo root:
```bash
pnpm typecheck
```
Expected: no errors in `use-billing.tsx`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-billing.tsx
git commit -m "fix(billing): include past_due in active subscription lookup"
```

---

## Task 2: Create `PlanSummaryCard` component

**Files:**
- Create: `apps/web/src/components/billing/plan-summary-card.tsx`
- Create: `apps/web/src/components/billing/plan-summary-card.test.tsx`

This component replaces `SubscriptionSection`. It renders four visual states: free (no sub), active, trialing (purple banner), and canceling/canceled (amber/red alert). It calls `useOrgSubscription` and `useBillingSummary` internally.

- [ ] **Step 1: Write the test file first**

Create `apps/web/src/components/billing/plan-summary-card.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";

// Pure utility functions extracted from the component for testing.
// Import them once the component file exists.

function formatCurrency(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deriveShowActions({
  subStatus,
  currentPlan,
  billingInterval,
  trialEligible,
}: {
  subStatus: string | null;
  currentPlan: string;
  billingInterval: "monthly" | "yearly" | null;
  trialEligible: boolean;
}) {
  const NEXT_TIER: Record<string, string | undefined> = { free: "basic", basic: "business" };
  const nextTier = NEXT_TIER[currentPlan] ?? null;
  const isActive = subStatus != null && ["active", "trialing", "past_due"].includes(subStatus);
  const showSubscribeNow = subStatus === "trialing";
  const showUpgrade = nextTier != null && !showSubscribeNow && (isActive || subStatus == null);
  const showSwitchYearly = isActive && billingInterval === "monthly" && !showSubscribeNow;
  const showTrialCta = subStatus == null && !showSubscribeNow && trialEligible;
  return { showUpgrade, showSwitchYearly, showTrialCta, showSubscribeNow, nextTier };
}

describe("formatCurrency", () => {
  it("formats whole numbers without decimals", () => {
    expect(formatCurrency(15)).toBe("$15");
    expect(formatCurrency(120)).toBe("$120");
  });

  it("formats fractional amounts to 2 decimal places", () => {
    expect(formatCurrency(8.33)).toBe("$8.33");
  });
});

describe("formatDateShort", () => {
  it("returns a non-empty string for a valid date", () => {
    const result = formatDateShort("2026-06-25");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });
});

describe("deriveShowActions", () => {
  it("shows upgrade on free plan with no subscription", () => {
    const r = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(r.showUpgrade).toBe(true);
    expect(r.nextTier).toBe("basic");
  });

  it("shows upgrade on active basic plan", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "basic", billingInterval: "monthly", trialEligible: false });
    expect(r.showUpgrade).toBe(true);
    expect(r.nextTier).toBe("business");
  });

  it("does not show upgrade on business plan", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showUpgrade).toBe(false);
  });

  it("shows switch-to-yearly when active and monthly", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "basic", billingInterval: "monthly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(true);
  });

  it("does not show switch-to-yearly when already yearly", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "basic", billingInterval: "yearly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(false);
  });

  it("shows trial CTA only when no sub and trialEligible", () => {
    const yes = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: true });
    const no = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(yes.showTrialCta).toBe(true);
    expect(no.showTrialCta).toBe(false);
  });

  it("shows subscribe-now when trialing, not upgrade", () => {
    const r = deriveShowActions({ subStatus: "trialing", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showSubscribeNow).toBe(true);
    expect(r.showUpgrade).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass (logic is in the test file itself)**

```bash
cd apps/web && pnpm test -- --run plan-summary-card
```
Expected: all tests PASS (the logic lives in the test file for now)

- [ ] **Step 3: Create `apps/web/src/components/billing/plan-summary-card.tsx`**

```typescript
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orbit/ui/components/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { AlertTriangle, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useBillingSummary,
  useChangePlan,
  useCheckout,
  useOrgSubscription,
  useStartTrial,
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
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
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
  trialEligible,
}: {
  subStatus: string | null;
  currentPlan: string;
  billingInterval: "monthly" | "yearly" | null;
  trialEligible: boolean;
}) {
  const nextTier = NEXT_TIER[currentPlan as SubscriptionPlan] ?? null;
  const isActive =
    subStatus != null &&
    ["active", "trialing", "past_due"].includes(subStatus);
  const showSubscribeNow = subStatus === "trialing";
  const showUpgrade =
    nextTier != null &&
    !showSubscribeNow &&
    (isActive || subStatus == null);
  const showSwitchYearly =
    isActive && billingInterval === "monthly" && !showSubscribeNow;
  const showTrialCta =
    subStatus == null && !showSubscribeNow && trialEligible;
  return { showUpgrade, showSwitchYearly, showTrialCta, showSubscribeNow, nextTier };
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

function TrialModal({
  open,
  onClose,
  onStartTrial,
  isStartingTrial,
  isCheckingOut,
}: {
  open: boolean;
  onClose: () => void;
  onStartTrial: () => void;
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
            Start a 7-day free trial with no credit card required.
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

export function PlanSummaryCard({ isPastDue = false }: { isPastDue?: boolean }) {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const queryClient = useQueryClient();
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [switchYearlyModalOpen, setSwitchYearlyModalOpen] = useState(false);

  const { data, isLoading } = useOrgSubscription(orgSlug);
  const { data: summary } = useBillingSummary(orgSlug);
  const checkout = useCheckout(orgSlug);
  const changePlan = useChangePlan(orgSlug);
  const startTrial = useStartTrial(orgSlug);

  if (isLoading || !data) {
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

  const { showUpgrade, showSwitchYearly, showTrialCta, showSubscribeNow, nextTier } =
    deriveShowActions({
      subStatus: sub?.status ?? null,
      currentPlan,
      billingInterval,
      trialEligible: summary?.trialEligible ?? false,
    });

  function invalidateSub() {
    queryClient.resetQueries({ queryKey: ["billing", orgSlug, "subscription"] });
  }

  function handleSubscribeNow() {
    if (currentPlan !== "basic" && currentPlan !== "business") return;
    changePlan.mutate(
      { plan: currentPlan, interval: "monthly", subscriptionId: sub?.stripeSubscriptionId },
      {
        onSuccess: (data) => {
          if (data?.url) return;
          toast.success("Plan activated successfully.");
          invalidateSub();
        },
        onError: (e: { message?: string }) =>
          toast.error(e.message ?? "Could not activate plan. Please try again."),
      },
    );
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

  function handleStartTrial() {
    startTrial.mutate(
      { plan: "business", interval: "monthly" },
      {
        onError: (e) =>
          toast.error(e.message ?? "Could not start trial. Please try again."),
      },
    );
  }

  // Trial state renders a distinct banner instead of the summary card
  if (sub?.status === "trialing") {
    return (
      <>
        <div className="overflow-hidden rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 dark:border-violet-700 dark:from-violet-950/40 dark:to-purple-950/40">
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
                Business features active · no card on file
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
              {showSubscribeNow && (
                <Button
                  size="sm"
                  onClick={handleSubscribeNow}
                  disabled={changePlan.isPending || isPastDue}
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
      </>
    );
  }

  return (
    <>
      {/* Canceling / canceled alert */}
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
          <AlertTitle>
            Subscription {isCanceled ? "canceled" : "canceling"}
          </AlertTitle>
          <AlertDescription
            className={
              isCancelingAtEnd
                ? "text-amber-700 dark:text-amber-400"
                : undefined
            }
          >
            {isCancelingAtEnd ? "Cancels on" : "Canceled. Access continues until"}{" "}
            <strong>
              {sub.periodEnd ? formatDateShort(sub.periodEnd) : "end of period"}
            </strong>
            {isCancelingAtEnd && ". You'll keep full access until then."}
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
        {(showUpgrade || showSwitchYearly || showTrialCta) && (
          <div className="flex flex-wrap gap-2 border-t px-5 py-3">
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
            {showTrialCta && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTrialModalOpen(true)}
                disabled={isPastDue}
              >
                <Zap className="size-3.5" />
                Try Business free
              </Button>
            )}
          </div>
        )}
      </div>

      <TrialModal
        open={trialModalOpen}
        onClose={() => setTrialModalOpen(false)}
        onStartTrial={handleStartTrial}
        isStartingTrial={startTrial.isPending}
        isCheckingOut={checkout.isPending}
      />
      <ConfirmSwitchYearlyModal
        open={switchYearlyModalOpen}
        onClose={() => setSwitchYearlyModalOpen(false)}
        onConfirm={confirmSwitchYearly}
        isPending={changePlan.isPending}
        monthlyPriceAnnual={((summary?.pricePerSeat ?? meta.monthlyPriceUsd) * 10) / 12}
      />
    </>
  );
}
```

- [ ] **Step 4: Update test file to import from the component**

Replace the local copies of the utility functions in the test file with imports:

```typescript
// Replace the three local function definitions with:
import {
  deriveShowActions,
  formatCurrency,
  formatDateShort,
} from "./plan-summary-card";
```

The test file should now look like:

```typescript
import { describe, expect, it } from "vitest";
import {
  deriveShowActions,
  formatCurrency,
  formatDateShort,
} from "./plan-summary-card";

describe("formatCurrency", () => {
  it("formats whole numbers without decimals", () => {
    expect(formatCurrency(15)).toBe("$15");
    expect(formatCurrency(120)).toBe("$120");
  });

  it("formats fractional amounts to 2 decimal places", () => {
    expect(formatCurrency(8.33)).toBe("$8.33");
  });
});

describe("formatDateShort", () => {
  it("returns a non-empty string for a valid date", () => {
    const result = formatDateShort("2026-06-25");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });
});

describe("deriveShowActions", () => {
  it("shows upgrade on free plan with no subscription", () => {
    const r = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(r.showUpgrade).toBe(true);
    expect(r.nextTier).toBe("basic");
  });

  it("shows upgrade on active basic plan", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "basic", billingInterval: "monthly", trialEligible: false });
    expect(r.showUpgrade).toBe(true);
    expect(r.nextTier).toBe("business");
  });

  it("does not show upgrade on business plan", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showUpgrade).toBe(false);
  });

  it("shows switch-to-yearly when active and monthly", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "basic", billingInterval: "monthly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(true);
  });

  it("does not show switch-to-yearly when already yearly", () => {
    const r = deriveShowActions({ subStatus: "active", currentPlan: "basic", billingInterval: "yearly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(false);
  });

  it("shows trial CTA only when no sub and trialEligible", () => {
    const yes = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: true });
    const no = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(yes.showTrialCta).toBe(true);
    expect(no.showTrialCta).toBe(false);
  });

  it("shows subscribe-now when trialing, not upgrade", () => {
    const r = deriveShowActions({ subStatus: "trialing", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showSubscribeNow).toBe(true);
    expect(r.showUpgrade).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests and verify all pass**

```bash
cd apps/web && pnpm test -- --run plan-summary-card
```
Expected: 9 tests PASS

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors in the new file

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/billing/plan-summary-card.tsx \
        apps/web/src/components/billing/plan-summary-card.test.tsx
git commit -m "feat(billing): add PlanSummaryCard with per-seat cost equation"
```

---

## Task 3: Wire `PlanSummaryCard` into `billing.tsx` and delete `subscription-section.tsx`

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx`
- Delete: `apps/web/src/components/billing/subscription-section.tsx`

- [ ] **Step 1: Open `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx`**

Replace the `SubscriptionSection` import (line 27) with `PlanSummaryCard`:

```typescript
// Remove this line:
import { SubscriptionSection } from "@/components/billing/subscription-section";

// Add this line:
import { PlanSummaryCard } from "@/components/billing/plan-summary-card";
```

- [ ] **Step 2: Replace `<SubscriptionSection>` with `<PlanSummaryCard>` in the JSX**

Find (around line 142):
```tsx
<SubscriptionSection isPastDue={isPastDue} />
```

Replace with:
```tsx
<PlanSummaryCard isPastDue={isPastDue} />
```

- [ ] **Step 3: Delete `subscription-section.tsx`**

```bash
rm apps/web/src/components/billing/subscription-section.tsx
```

- [ ] **Step 4: Run typecheck to confirm nothing else imports `SubscriptionSection`**

```bash
pnpm typecheck
```
Expected: no errors. If you see `"Cannot find module '.../subscription-section'"` in any other file, add the `PlanSummaryCard` import there too (there should be none).

- [ ] **Step 5: Run all tests**

```bash
cd apps/web && pnpm test -- --run
```
Expected: all existing tests pass, new tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx
git rm apps/web/src/components/billing/subscription-section.tsx
git commit -m "refactor(billing): replace SubscriptionSection with PlanSummaryCard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Summary card with plan name, status badge, total cost, next invoice date
- ✅ Cost equation row (`seats × price/seat = total`)
- ✅ Stats row (seats used, price per seat, renewal date)
- ✅ Trial state banner with countdown and subscribe now CTA
- ✅ Canceling/canceled alert (amber/red)
- ✅ Contextual actions: upgrade, switch to yearly, trial CTA
- ✅ Past-due alert links to portal (in `billing.tsx`, portal button always enabled — already fixed in previous session)
- ✅ `currentPlan` derived from `summary.plan` (not `sub.plan`) to handle past-due orgs correctly
- ✅ `memberCount` from `summary.usage.members.current` (DB count, not full member list)
- ✅ Bug fix: `past_due` included in `useOrgSubscription` find predicate (Task 1)

**Placeholder scan:** No TBDs or incomplete steps. All code blocks are complete. ✓

**Type consistency:**
- `deriveShowActions` defined in Task 2 Step 3, used internally in component — same name ✓
- `formatCurrency` / `formatDateShort` exported in component, imported in test — same names ✓
- `PlanSummaryCard` created in Task 2, imported in Task 3 — same name ✓
- `useOrgSubscription` returns `.subscription.stripeSubscriptionId` — used in `handleUpgrade` and `handleSubscribeNow` ✓
