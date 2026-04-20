# Stripe & Feature Flags Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the billing settings page (Tailark pricing-3 table + current plan card) and a `useFeatureFlag` / `UpgradeGate` system that gates UI features by subscription tier.

**Architecture:** The backend already exposes subscription, checkout, and portal endpoints — this is purely frontend. `useFeatureFlag` derives flag state from the already-cached `useOrgSubscription` query (no extra network calls). `UpgradeGate` wraps any element: disables it visually and opens an upgrade modal on click when the flag is off.

**Tech Stack:** React 19, TanStack Router, TanStack Query, `@orbit/shared` (TIER_METADATA), `@orbit/ui` (Tooltip/Dialog from base-ui), Tailark pricing-3 (shadcn registry block), Vitest + @testing-library/react.

---

## Task 1: Install Tailark pricing-3 block

**Files:**
- Modify: `packages/ui/src/components/` (files created by shadcn CLI)

**Step 1: Run the install command from the packages/ui directory**

```bash
cd packages/ui && pnpm dlx shadcn add @tailark/pricing-3
```

Expected: shadcn CLI prompts for confirmation, then writes component file(s) under `packages/ui/src/components/`.

**Step 2: Inspect what was generated**

```bash
ls packages/ui/src/components/ | grep -i pric
```

Note the exact filename(s) created — it may be `pricing.tsx`, `pricing-3.tsx`, or similar. Read the file and check:
- Does it import from `@radix-ui/*`? If so, those primitives need to be swapped for the project's base-ui equivalents from `@orbit/ui/components/`.
- Does it use `cn()`? It should import from `@orbit/ui/lib/utils`.

**Step 3: Fix any import issues**

If the generated file imports from `@radix-ui/react-dialog` or similar, replace with the project's equivalents:

| Generated import | Replace with |
| --- | --- |
| `@radix-ui/react-dialog` | `@orbit/ui/components/dialog` |
| `@radix-ui/react-tooltip` | `@orbit/ui/components/tooltip` |
| `clsx` / `tailwind-merge` directly | `cn` from `@orbit/ui/lib/utils` |

**Step 4: Commit**

```bash
git add packages/ui/src/components/
git commit -m "feat(billing): install tailark pricing-3 block"
```

---

## Task 2: Export `TierFlags` type from `@orbit/shared`

**Files:**
- Modify: `packages/shared/src/types/billing.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Add the `TierFlags` export to `billing.ts`**

Open `packages/shared/src/types/billing.ts`. After the `TierMetadata` interface definition, add:

```ts
export type TierFlags = TierMetadata["flags"];
```

**Step 2: Re-export from the package index**

Open `packages/shared/src/index.ts`. Add `TierFlags` to the billing export line:

```ts
export {
  type CheckoutResponse,
  type PortalResponse,
  SUBSCRIPTION_TIERS,
  type SubscriptionResponse,
  type SubscriptionTier,
  TIER_METADATA,
  type TierFlags,
  type TierMetadata,
} from "./types/billing.js";
```

**Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add packages/shared/src/types/billing.ts packages/shared/src/index.ts
git commit -m "feat(billing): export TierFlags type from @orbit/shared"
```

---

## Task 3: `useFeatureFlag` hook

**Files:**
- Create: `apps/web/src/hooks/use-feature-flag.ts`
- Create: `apps/web/src/hooks/use-feature-flag.test.ts`

**Step 1: Write the failing tests**

Create `apps/web/src/hooks/use-feature-flag.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseOrgSubscription = vi.fn();

vi.mock("@/hooks/use-billing", () => ({
  useOrgSubscription: () => mockUseOrgSubscription(),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
}));

// Import AFTER mocks
const { useFeatureFlag } = await import("./use-feature-flag");

describe("useFeatureFlag", () => {
  beforeEach(() => mockUseOrgSubscription.mockClear());

  it("returns enabled:true while loading (fail-open)", () => {
    mockUseOrgSubscription.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
    expect(result.current.enabled).toBe(true);
  });

  it("returns enabled:true on error (fail-open)", () => {
    mockUseOrgSubscription.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
    expect(result.current.enabled).toBe(true);
  });

  it("returns enabled:false for hasAdvancedAnalytics on free tier", () => {
    mockUseOrgSubscription.mockReturnValue({
      data: { tier: "free", usage: { members: { current: 1, limit: 5 } }, subscription: null },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
    expect(result.current.enabled).toBe(false);
    expect(result.current.requiredTier).toBe("team");
  });

  it("returns enabled:true for hasAdvancedAnalytics on team tier", () => {
    mockUseOrgSubscription.mockReturnValue({
      data: { tier: "team", usage: { members: { current: 3, limit: 25 } }, subscription: null },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
    expect(result.current.enabled).toBe(true);
  });

  it("returns requiredTier:enterprise for hasSSO on pro tier", () => {
    mockUseOrgSubscription.mockReturnValue({
      data: { tier: "pro", usage: { members: { current: 10, limit: 100 } }, subscription: null },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useFeatureFlag("hasSSO"));
    expect(result.current.enabled).toBe(false);
    expect(result.current.requiredTier).toBe("enterprise");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test -- use-feature-flag
```

Expected: FAIL — module not found.

**Step 3: Implement the hook**

Create `apps/web/src/hooks/use-feature-flag.ts`:

```ts
import {
  SUBSCRIPTION_TIERS,
  TIER_METADATA,
  type SubscriptionTier,
  type TierFlags,
} from "@orbit/shared";
import { useParams } from "@tanstack/react-router";
import { useOrgSubscription } from "@/hooks/use-billing";

const TIER_ORDER: SubscriptionTier[] = [
  SUBSCRIPTION_TIERS.FREE,
  SUBSCRIPTION_TIERS.TEAM,
  SUBSCRIPTION_TIERS.PRO,
  SUBSCRIPTION_TIERS.ENTERPRISE,
];

export function useFeatureFlag(flag: keyof TierFlags): {
  enabled: boolean;
  requiredTier: SubscriptionTier;
} {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const { data, isLoading, isError } = useOrgSubscription(orgSlug);

  if (isLoading || isError || !data) {
    return { enabled: true, requiredTier: SUBSCRIPTION_TIERS.FREE };
  }

  const enabled = TIER_METADATA[data.tier].flags[flag];
  const requiredTier =
    TIER_ORDER.find((t) => TIER_METADATA[t].flags[flag]) ??
    SUBSCRIPTION_TIERS.ENTERPRISE;

  return { enabled, requiredTier };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test -- use-feature-flag
```

Expected: all 5 tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/hooks/use-feature-flag.ts apps/web/src/hooks/use-feature-flag.test.ts
git commit -m "feat(billing): add useFeatureFlag hook"
```

---

## Task 4: `PricingTable` component

**Files:**
- Create: `apps/web/src/components/billing/pricing-table.tsx`

This component wraps the Tailark block installed in Task 1 and wires it to the project's `TIER_METADATA`.

**Step 1: Note the Tailark block's filename from Task 1**

The raw Tailark block is in `packages/ui/src/components/`. Check what it exports — it will be something like `export function PricingThree(...)` or similar.

**Step 2: Create the adapter component**

Create `apps/web/src/components/billing/pricing-table.tsx`:

```tsx
import { SUBSCRIPTION_TIERS, TIER_METADATA, type SubscriptionTier } from "@orbit/shared";

// Replace "PricingThree" with the actual export name from the Tailark block
// Replace "@orbit/ui/components/pricing-three" with the actual path
import { PricingThree } from "@orbit/ui/components/<tailark-filename>";

interface PricingTableProps {
  currentTier: SubscriptionTier;
  highlightTier?: SubscriptionTier;
  onSelectTier?: (tier: SubscriptionTier) => void;
}

const TIER_ORDER: SubscriptionTier[] = [
  SUBSCRIPTION_TIERS.FREE,
  SUBSCRIPTION_TIERS.TEAM,
  SUBSCRIPTION_TIERS.PRO,
  SUBSCRIPTION_TIERS.ENTERPRISE,
];

export function PricingTable({ currentTier, highlightTier, onSelectTier }: PricingTableProps) {
  return (
    <PricingThree
      plans={TIER_ORDER.map((tier) => {
        const meta = TIER_METADATA[tier];
        const isCurrent = tier === currentTier;
        const isHighlighted = tier === (highlightTier ?? SUBSCRIPTION_TIERS.PRO);

        return {
          id: tier,
          name: meta.label,
          description: meta.description,
          price: meta.monthlyPriceUsd === 0 ? "Free" : `$${meta.monthlyPriceUsd}`,
          period: meta.monthlyPriceUsd === 0 ? undefined : "/ mo",
          badge: isHighlighted ? "Most popular" : undefined,
          features: [...meta.features],
          cta: isCurrent ? "Current plan" : tier === SUBSCRIPTION_TIERS.FREE ? "Downgrade" : "Get started",
          ctaDisabled: isCurrent || tier === SUBSCRIPTION_TIERS.FREE,
          onCta: isCurrent || tier === SUBSCRIPTION_TIERS.FREE
            ? undefined
            : () => onSelectTier?.(tier),
        };
      })}
    />
  );
}
```

> **Note:** The exact props accepted by the Tailark block depend on its generated code. After reading the generated file in Task 1, adapt the `PricingThree` usage above to match its actual API. If it renders hardcoded content rather than accepting a `plans` prop, replace the block's content directly with JSX driven by the `TIER_ORDER.map(...)` above.

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

Fix any type errors before continuing.

**Step 4: Commit**

```bash
git add apps/web/src/components/billing/pricing-table.tsx
git commit -m "feat(billing): add PricingTable component wrapping Tailark block"
```

---

## Task 5: `CurrentPlanCard` component

**Files:**
- Create: `apps/web/src/components/billing/current-plan-card.tsx`
- Create: `apps/web/src/components/billing/current-plan-card.test.tsx`

**Step 1: Write the failing tests**

Create `apps/web/src/components/billing/current-plan-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mutateMock = vi.fn();

vi.mock("@/hooks/use-billing", () => ({
  useOrgSubscription: () => ({
    data: {
      tier: "team",
      tierLabel: "Startup",
      usage: { members: { current: 8, limit: 25 } },
      subscription: {
        status: "active",
        currentPeriodEnd: new Date("2026-05-20"),
        cancelAtPeriodEnd: false,
      },
    },
    isLoading: false,
  }),
  usePortal: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
}));

const { CurrentPlanCard } = await import("./current-plan-card");

describe("CurrentPlanCard", () => {
  it("shows the tier label", () => {
    render(<CurrentPlanCard />);
    expect(screen.getByText("Startup")).toBeDefined();
  });

  it("shows member usage", () => {
    render(<CurrentPlanCard />);
    expect(screen.getByText(/8\s*\/\s*25/)).toBeDefined();
  });

  it("shows Manage subscription button when subscription exists", () => {
    render(<CurrentPlanCard />);
    expect(screen.getByRole("button", { name: /manage subscription/i })).toBeDefined();
  });
});
```

Add a second test file for the free/null-subscription case:

```tsx
// At the bottom of the same test file, add a second describe block:

vi.mock("@/hooks/use-billing", () => ({
  useOrgSubscription: () => ({
    data: {
      tier: "free",
      tierLabel: "Hobby",
      usage: { members: { current: 2, limit: 5 } },
      subscription: null,
    },
    isLoading: false,
  }),
  usePortal: () => ({ mutate: mutateMock, isPending: false }),
}));
```

> **Note:** Because `vi.mock` is hoisted, you can't override it inside a describe block in the same file. Write the free-tier case as a separate test file: `current-plan-card-free.test.tsx` with its own mock that returns `subscription: null` and asserts the button is absent.

Create `apps/web/src/components/billing/current-plan-card-free.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-billing", () => ({
  useOrgSubscription: () => ({
    data: {
      tier: "free",
      tierLabel: "Hobby",
      usage: { members: { current: 2, limit: 5 } },
      subscription: null,
    },
    isLoading: false,
  }),
  usePortal: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
}));

const { CurrentPlanCard } = await import("./current-plan-card");

describe("CurrentPlanCard (free tier)", () => {
  it("shows Unlimited for members when limit is -1", () => {
    render(<CurrentPlanCard />);
    expect(screen.getByText(/hobby/i)).toBeDefined();
  });

  it("hides Manage subscription button when on free tier", () => {
    render(<CurrentPlanCard />);
    expect(screen.queryByRole("button", { name: /manage subscription/i })).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test -- current-plan-card
```

Expected: FAIL — module not found.

**Step 3: Implement the component**

Create `apps/web/src/components/billing/current-plan-card.tsx`:

```tsx
import { TIER_METADATA } from "@orbit/shared";
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { useParams } from "@tanstack/react-router";
import { useOrgSubscription, usePortal } from "@/hooks/use-billing";
import { toast } from "sonner";

export function CurrentPlanCard() {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const { data, isLoading } = useOrgSubscription(orgSlug);
  const portal = usePortal(orgSlug);

  if (isLoading || !data) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  const meta = TIER_METADATA[data.tier];
  const { current, limit } = data.usage.members;
  const usagePercent = limit === -1 ? 0 : Math.round((current / limit) * 100);

  function handlePortal() {
    portal.mutate(undefined, {
      onError: () => toast.error("Could not open billing portal."),
    });
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{meta.label}</span>
            <Badge variant="secondary">{data.tier}</Badge>
          </div>
          {data.subscription && (
            <p className="text-sm text-muted-foreground">
              {data.subscription.cancelAtPeriodEnd
                ? `Cancels on ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          )}
        </div>
        {data.subscription && (
          <Button variant="outline" size="sm" onClick={handlePortal} disabled={portal.isPending}>
            Manage subscription
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Members</span>
          <span>
            {current} / {limit === -1 ? "Unlimited" : limit}
          </span>
        </div>
        {limit !== -1 && (
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test -- current-plan-card
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/billing/
git commit -m "feat(billing): add CurrentPlanCard component"
```

---

## Task 6: `UpgradeModal` component

**Files:**
- Create: `apps/web/src/components/billing/upgrade-modal.tsx`

No separate tests — the modal is a thin shell that composes `Dialog` + `PricingTable`; those are tested independently.

**Step 1: Implement the component**

Create `apps/web/src/components/billing/upgrade-modal.tsx`:

```tsx
import type { SubscriptionTier } from "@orbit/shared";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@orbit/ui/components/dialog";
import { useParams } from "@tanstack/react-router";
import { useCheckout } from "@/hooks/use-billing";
import { PricingTable } from "./pricing-table";
import { toast } from "sonner";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightTier?: SubscriptionTier;
}

export function UpgradeModal({ open, onOpenChange, highlightTier }: UpgradeModalProps) {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const checkout = useCheckout(orgSlug);

  function handleSelectTier(tier: SubscriptionTier) {
    checkout.mutate(tier, {
      onError: () => toast.error("Could not start checkout. Please try again."),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Upgrade your plan</DialogTitle>
        </DialogHeader>
        <PricingTable
          currentTier="free"
          highlightTier={highlightTier}
          onSelectTier={handleSelectTier}
        />
      </DialogContent>
    </Dialog>
  );
}
```

> **Note:** `currentTier="free"` is a placeholder here since the modal doesn't know the org's current tier. In Task 7, `UpgradeGate` will pass `currentTier` from the subscription query. Refactor `UpgradeModal` to accept `currentTier` as a prop at that point.

**Step 2: Typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/components/billing/upgrade-modal.tsx
git commit -m "feat(billing): add UpgradeModal component"
```

---

## Task 7: `UpgradeGate` component

**Files:**
- Create: `apps/web/src/components/billing/upgrade-gate.tsx`
- Create: `apps/web/src/components/billing/upgrade-gate.test.tsx`

Also update `UpgradeModal` to accept `currentTier` prop (noted in Task 6).

**Step 1: Update UpgradeModal to accept currentTier**

Open `apps/web/src/components/billing/upgrade-modal.tsx`. Add `currentTier` to `UpgradeModalProps` and pass it through:

```tsx
interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightTier?: SubscriptionTier;
  currentTier: SubscriptionTier;  // add this
}

// Inside the component, pass to PricingTable:
<PricingTable
  currentTier={currentTier}   // was "free" hardcoded
  highlightTier={highlightTier}
  onSelectTier={handleSelectTier}
/>
```

**Step 2: Write the failing tests**

Create `apps/web/src/components/billing/upgrade-gate.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-feature-flag", () => ({
  useFeatureFlag: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("@/hooks/use-billing", () => ({
  useOrgSubscription: () => ({ data: { tier: "free" }, isLoading: false }),
  useCheckout: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Import AFTER mocks
import { useFeatureFlag } from "@/hooks/use-feature-flag";
const { UpgradeGate } = await import("./upgrade-gate");

describe("UpgradeGate", () => {
  it("renders children normally when feature is enabled", () => {
    vi.mocked(useFeatureFlag).mockReturnValue({ enabled: true, requiredTier: "team" });
    render(
      <UpgradeGate flag="hasAdvancedAnalytics">
        <button>Analytics</button>
      </UpgradeGate>,
    );
    expect(screen.getByRole("button", { name: "Analytics" })).toBeDefined();
    // Should NOT be wrapped in the disabled overlay
    const btn = screen.getByRole("button", { name: "Analytics" });
    expect(btn.closest("[data-upgrade-gate]")).toBeNull();
  });

  it("renders children as disabled when feature is not enabled", () => {
    vi.mocked(useFeatureFlag).mockReturnValue({ enabled: false, requiredTier: "pro" });
    render(
      <UpgradeGate flag="hasCustomBranding">
        <button>Branding</button>
      </UpgradeGate>,
    );
    const gate = document.querySelector("[data-upgrade-gate]");
    expect(gate).toBeDefined();
    expect(gate?.className).toMatch(/opacity-50/);
  });

  it("opens upgrade modal on click when feature is not enabled", () => {
    vi.mocked(useFeatureFlag).mockReturnValue({ enabled: false, requiredTier: "pro" });
    render(
      <UpgradeGate flag="hasCustomBranding">
        <button>Branding</button>
      </UpgradeGate>,
    );
    const gate = document.querySelector("[data-upgrade-gate]") as HTMLElement;
    fireEvent.click(gate);
    // Modal title should appear
    expect(screen.getByText(/upgrade your plan/i)).toBeDefined();
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
cd apps/web && pnpm test -- upgrade-gate
```

Expected: FAIL — module not found.

**Step 4: Implement the component**

Create `apps/web/src/components/billing/upgrade-gate.tsx`:

```tsx
import type { TierFlags } from "@orbit/shared";
import { TIER_METADATA } from "@orbit/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orbit/ui/components/tooltip";
import { useState, type ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useOrgSubscription } from "@/hooks/use-billing";
import { useParams } from "@tanstack/react-router";
import { UpgradeModal } from "./upgrade-modal";

interface UpgradeGateProps {
  flag: keyof TierFlags;
  children: ReactNode;
  message?: string;
}

export function UpgradeGate({ flag, children, message }: UpgradeGateProps) {
  const { enabled, requiredTier } = useFeatureFlag(flag);
  const [modalOpen, setModalOpen] = useState(false);
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const { data } = useOrgSubscription(orgSlug);

  if (enabled) return <>{children}</>;

  const defaultMessage = `Available on ${TIER_METADATA[requiredTier].label} and above. Click to upgrade.`;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              data-upgrade-gate
              className="relative cursor-pointer"
              onClick={() => setModalOpen(true)}
            >
              <div className="pointer-events-none opacity-50 select-none">
                {children}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>{message ?? defaultMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        highlightTier={requiredTier}
        currentTier={data?.tier ?? "free"}
      />
    </>
  );
}
```

**Step 5: Run tests to verify they pass**

```bash
cd apps/web && pnpm test -- upgrade-gate
```

Expected: all tests PASS.

**Step 6: Commit**

```bash
git add apps/web/src/components/billing/upgrade-gate.tsx \
        apps/web/src/components/billing/upgrade-gate.test.tsx \
        apps/web/src/components/billing/upgrade-modal.tsx
git commit -m "feat(billing): add UpgradeGate component and wire UpgradeModal"
```

---

## Task 8: Billing settings page

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx`

**Step 1: Replace the stub**

Open `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx` and replace the entire file:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { PricingTable } from "@/components/billing/pricing-table";
import { useParams } from "@tanstack/react-router";
import { useOrgSubscription, useCheckout } from "@/hooks/use-billing";
import { toast } from "sonner";
import type { SubscriptionTier } from "@orbit/shared";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const { data } = useOrgSubscription(orgSlug);
  const checkout = useCheckout(orgSlug);

  function handleSelectTier(tier: SubscriptionTier) {
    checkout.mutate(tier, {
      onError: () => toast.error("Could not start checkout. Please try again."),
    });
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
          currentTier={data?.tier ?? "free"}
          onSelectTier={handleSelectTier}
        />
      </div>
    </div>
  );
}
```

**Step 2: Typecheck and lint**

```bash
pnpm typecheck && pnpm check
```

Fix any issues.

**Step 3: Manual smoke test**

Start the dev server:

```bash
pnpm dev
```

Navigate to `http://localhost:3000/<your-org-slug>/settings/billing`.

Verify:
- [ ] Current plan card renders with tier label and member usage
- [ ] Pricing table shows all 4 tiers
- [ ] Current tier is highlighted / button disabled
- [ ] PRO (Business) has "Most popular" badge
- [ ] "Get started" on a paid tier triggers Stripe checkout redirect (requires real Stripe key in `.env`)
- [ ] "Manage subscription" button is hidden if on FREE tier, visible if on paid tier

**Step 4: Commit**

```bash
git add apps/web/src/routes/_workspace/\$orgSlug/settings/billing.tsx
git commit -m "feat(billing): implement billing settings page"
```

---

## Task 9: Run full test suite and typecheck

**Step 1: Run all tests**

```bash
cd apps/web && pnpm test
```

Expected: all tests pass (including the new ones from Tasks 3, 5, 7).

**Step 2: Full typecheck**

```bash
pnpm typecheck
```

**Step 3: Lint and format**

```bash
pnpm check
```

Fix any issues that arise.

**Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "chore(billing): fix lint and type errors"
```
