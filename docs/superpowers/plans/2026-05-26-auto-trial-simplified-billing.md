# Auto-Trial on Workspace Creation + Simplified Trial UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-start a 14-day Business trial for every new organization and strip all trial-management CTAs from the billing UI (trial banner becomes read-only countdown).

**Architecture:** Backend creates a Stripe customer + trialing subscription in `afterCreateOrganization` hook; auth plan config no longer carries `freeTrial` so no second trial gets added when a user later goes to paid checkout; frontend trial banner drops all buttons and modals.

**Tech Stack:** NestJS / Drizzle / Stripe SDK (backend); React 19 / TanStack Query / Vitest (frontend)

---

## File map

| File | Change |
|---|---|
| `apps/api/src/auth/auth.ts` | Remove `freeTrial: { days: 7 }` from Business plan |
| `apps/api/src/auth/auth.module.ts` | Same + pass full `Stripe` type to hooks factory |
| `apps/api/src/auth/organization-billing-hooks.ts` | Add `autoStartTrial()`; call from `afterCreateOrganization`; change factory param to `Stripe` |
| `apps/api/src/billing/billing.service.ts` | Delete `activateTrial()` |
| `apps/api/src/billing/billing.controller.ts` | Delete `POST /:orgSlug/activate-trial` endpoint |
| `apps/api/src/billing/billing.controller.spec.ts` | No change needed |
| `apps/api/src/billing/billing.service.spec.ts` | No change needed |
| `apps/web/src/hooks/use-billing.tsx` | Delete `useStartTrial`, `useActivateTrial` |
| `apps/web/src/components/billing/plan-summary-card.tsx` | Remove `showTrialCta`/`showSubscribeNow` from `deriveShowActions`; remove all trial banner buttons, modals, handlers |
| `apps/web/src/components/billing/plan-summary-card.test.tsx` | Remove/update test cases for `showTrialCta` and `showSubscribeNow` |

---

## Task 1 — Remove `freeTrial` from auth plan config

**Files:**
- Modify: `apps/api/src/auth/auth.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Edit `auth.ts`**

  Find the Business plan entry (around line 65–69) and remove the `freeTrial` line:

  ```typescript
  // Before
  {
      name: "business",
      lookupKey: "business_monthly",
      annualDiscountLookupKey: "business_yearly",
      freeTrial: { days: 7 },
  },

  // After
  {
      name: "business",
      lookupKey: "business_monthly",
      annualDiscountLookupKey: "business_yearly",
  },
  ```

- [ ] **Step 2: Edit `auth.module.ts`**

  Same change at the corresponding line (around line 142–146):

  ```typescript
  // Before
  {
      name: "business",
      lookupKey: "business_monthly",
      annualDiscountLookupKey: "business_yearly",
      freeTrial: { days: 7 },
  },

  // After
  {
      name: "business",
      lookupKey: "business_monthly",
      annualDiscountLookupKey: "business_yearly",
  },
  ```

- [ ] **Step 3: Verify both files match**

  Run a quick diff to confirm both auth files are in sync on plan config (the dual-instance sync rule):

  ```bash
  grep -n "freeTrial" apps/api/src/auth/auth.ts apps/api/src/auth/auth.module.ts
  ```

  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/auth/auth.ts apps/api/src/auth/auth.module.ts
  git commit -m "feat(billing): remove freeTrial from Business plan config — auto-trial replaces it"
  ```

---

## Task 2 — Delete the `activate-trial` endpoint and service method

**Files:**
- Modify: `apps/api/src/billing/billing.service.ts`
- Modify: `apps/api/src/billing/billing.controller.ts`

- [ ] **Step 1: Delete `activateTrial()` from `billing.service.ts`**

  Remove the entire method (lines 141–191 in the current file):

  ```typescript
  // DELETE this entire method:
  async activateTrial(
      organizationId: string,
      successUrl: string,
      cancelUrl: string,
  ): Promise<{ url: string }> { ... }
  ```

- [ ] **Step 2: Delete `POST /:orgSlug/activate-trial` from `billing.controller.ts`**

  Remove the entire endpoint (lines 52–72):

  ```typescript
  // DELETE this entire endpoint:
  @Post(":orgSlug/activate-trial")
  async activateTrial(
      @Param("orgSlug") orgSlug: string,
      @Body() body: { successUrl: string; cancelUrl: string },
      @CurrentUser() user: User,
  ): Promise<{ url: string }> { ... }
  ```

- [ ] **Step 3: Run API tests to confirm no breakage**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all existing tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/billing/billing.service.ts apps/api/src/billing/billing.controller.ts
  git commit -m "feat(billing): remove activate-trial endpoint — auto-trial replaces manual trial activation"
  ```

---

## Task 3 — Add `autoStartTrial()` and wire it into `afterCreateOrganization`

**Files:**
- Modify: `apps/api/src/auth/organization-billing-hooks.ts`

- [ ] **Step 1: Write the failing test for `autoStartTrial`**

  Create `apps/api/src/auth/organization-billing-hooks.spec.ts`:

  ```typescript
  import { autoStartTrial } from "./organization-billing-hooks";

  describe("autoStartTrial", () => {
    function createDeps(overrides?: {
      existingSub?: object | null;
      orgStripeCustomerId?: string | null;
    }) {
      const existingSub = overrides?.existingSub !== undefined ? overrides.existingSub : null;
      const orgStripeCustomerId = overrides?.orgStripeCustomerId ?? null;

      const db = {
        query: {
          subscription: {
            findFirst: jest.fn().mockResolvedValue(existingSub),
          },
          organization: {
            findFirst: jest.fn().mockResolvedValue({
              id: "org_1",
              name: "Acme",
              stripeCustomerId: orgStripeCustomerId,
            }),
          },
        },
        update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
        insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
      };

      const stripe = {
        customers: {
          create: jest.fn().mockResolvedValue({ id: "cus_new" }),
        },
        subscriptions: {
          create: jest.fn().mockResolvedValue({ id: "sub_abc" }),
        },
        prices: {
          list: jest.fn().mockResolvedValue({
            data: [{ id: "price_biz_monthly", lookup_key: "business_monthly", unit_amount: 1500 }],
          }),
        },
      };

      return { db, stripe };
    }

    it("skips when a subscription already exists for the org", async () => {
      const { db, stripe } = createDeps({ existingSub: { id: "sub_existing" } });

      await autoStartTrial("org_1", db as never, stripe as never);

      expect(stripe.subscriptions.create).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("creates a Stripe customer when org has no stripeCustomerId", async () => {
      const { db, stripe } = createDeps({ orgStripeCustomerId: null });

      await autoStartTrial("org_1", db as never, stripe as never);

      expect(stripe.customers.create).toHaveBeenCalledWith({
        name: "Acme",
        metadata: { referenceId: "org_1", referenceType: "organization" },
      });
    });

    it("reuses existing stripeCustomerId without creating a new customer", async () => {
      const { db, stripe } = createDeps({ orgStripeCustomerId: "cus_existing" });

      await autoStartTrial("org_1", db as never, stripe as never);

      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates a trialing Stripe subscription with 14-day trial_end", async () => {
      const before = Math.floor(Date.now() / 1000);
      const { db, stripe } = createDeps();

      await autoStartTrial("org_1", db as never, stripe as never);

      const call = stripe.subscriptions.create.mock.calls[0][0];
      expect(call.items).toEqual([{ price: "price_biz_monthly", quantity: 1 }]);
      expect(call.trial_end).toBeGreaterThanOrEqual(before + 14 * 24 * 60 * 60);
      expect(call.payment_settings.payment_method_collection).toBe("if_required");
      expect(call.metadata.referenceId).toBe("org_1");
    });

    it("inserts a subscription row with status trialing and plan business", async () => {
      const { db, stripe } = createDeps();

      await autoStartTrial("org_1", db as never, stripe as never);

      const inserted = db.insert.mock.calls[0];
      expect(inserted).toBeDefined();
      const values = db.insert().values.mock.calls[0][0];
      expect(values.plan).toBe("business");
      expect(values.status).toBe("trialing");
      expect(values.referenceId).toBe("org_1");
      expect(values.stripeSubscriptionId).toBe("sub_abc");
      expect(values.seats).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd apps/api && pnpm test -- --testPathPattern="organization-billing-hooks"
  ```

  Expected: fails with "autoStartTrial is not a function" or similar import error.

- [ ] **Step 3: Implement `autoStartTrial` in `organization-billing-hooks.ts`**

  Add the Stripe type import at the top of the file (DML comes from the `db` instance, no extra Drizzle imports needed):

  ```typescript
  import type Stripe from "stripe";
  ```

  Add this exported function after the `syncStripeSeatQuantity` function:

  ```typescript
  export async function autoStartTrial(
    orgId: string,
    db: Db,
    stripeClient: Stripe,
  ): Promise<void> {
    try {
      // Idempotency: skip if trial already exists
      const existing = await db.query.subscription.findFirst({
        where: eq(schema.subscription.referenceId, orgId),
      });
      if (existing) return;

      const org = await db.query.organization.findFirst({
        where: eq(schema.organization.id, orgId),
      });
      if (!org) return;

      // Create or reuse Stripe customer
      let customerId = org.stripeCustomerId ?? null;
      if (!customerId) {
        const customer = await stripeClient.customers.create({
          name: org.name,
          metadata: { referenceId: orgId, referenceType: "organization" },
        });
        customerId = customer.id;
        await db
          .update(schema.organization)
          .set({ stripeCustomerId: customerId })
          .where(eq(schema.organization.id, orgId));
      }

      // Resolve Business monthly price
      const price = await getStripePriceByLookupKey(
        stripeClient as unknown as StripeClientForSeatBilling,
        PLAN_LOOKUP_KEYS.business!.monthly,
      );
      if (!price) {
        seatBillingLogger.error(
          `Business monthly price not found; cannot auto-start trial for org ${orgId}`,
        );
        return;
      }

      // Create trialing Stripe subscription
      const trialEndUnix =
        Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
      const stripeSub = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id, quantity: 1 }],
        trial_end: trialEndUnix,
        payment_settings: { payment_method_collection: "if_required" },
        metadata: { referenceId: orgId, referenceType: "organization" },
      });

      // Insert subscription row
      const now = new Date();
      const periodEnd = new Date(trialEndUnix * 1000);
      await db.insert(schema.subscription).values({
        plan: "business",
        referenceId: orgId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id,
        status: "trialing",
        periodStart: now,
        periodEnd,
        trialStart: now,
        trialEnd: periodEnd,
        seats: 1,
        cancelAtPeriodEnd: false,
      });
    } catch (error) {
      seatBillingLogger.error(
        `autoStartTrial failed for org ${orgId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
  ```

- [ ] **Step 4: Call `autoStartTrial` from `afterCreateOrganization`**

  Update the `afterCreateOrganization` hook in the `createOrganizationHooks` factory:

  ```typescript
  afterCreateOrganization: async ({ organization: org, user: owner }) => {
    void emailQueue.add("send-workspace-created", {
      type: "send-workspace-created",
      to: owner.email,
      data: {
        ownerName: owner.name,
        organizationName: org.name,
        workspaceUrl: `${appUrl}/${org.slug}`,
      },
    });

    void autoStartTrial(org.id, db, stripeClient);
  },
  ```

- [ ] **Step 5: Update the factory parameter type to accept full Stripe**

  Change the factory's `stripeClient` param from `StripeClientForSeatBilling` to `Stripe`:

  ```typescript
  // Before
  export function createOrganizationHooks({
    db,
    emailQueue,
    notificationQueue,
    appUrl,
    stripeClient,
  }: {
    db: Db;
    emailQueue: Queue;
    notificationQueue: Queue;
    appUrl: string;
    stripeClient: StripeClientForSeatBilling;
  }) {

  // After
  export function createOrganizationHooks({
    db,
    emailQueue,
    notificationQueue,
    appUrl,
    stripeClient,
  }: {
    db: Db;
    emailQueue: Queue;
    notificationQueue: Queue;
    appUrl: string;
    stripeClient: Stripe;
  }) {
  ```

  The `syncStripeSeatQuantity` calls that pass `stripeClient` still work because `Stripe` satisfies `StripeClientForSeatBilling` structurally.

- [ ] **Step 6: Run tests to confirm they pass**

  ```bash
  cd apps/api && pnpm test -- --testPathPattern="organization-billing-hooks"
  ```

  Expected: all 5 tests pass.

- [ ] **Step 7: Run all API tests**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all tests pass.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/api/src/auth/organization-billing-hooks.ts apps/api/src/auth/organization-billing-hooks.spec.ts
  git commit -m "feat(billing): auto-start 14-day Business trial on org creation"
  ```

---

## Task 4 — Remove `showTrialCta` and `showSubscribeNow` from `deriveShowActions`

**Files:**
- Modify: `apps/web/src/components/billing/plan-summary-card.tsx`
- Modify: `apps/web/src/components/billing/plan-summary-card.test.tsx`

- [ ] **Step 1: Update the tests first (TDD — make them fail before the change)**

  In `plan-summary-card.test.tsx`, remove the two test cases that reference `showTrialCta` and `showSubscribeNow`:

  ```typescript
  // DELETE this test:
  it("shows trial CTA only when no sub and trialEligible", () => {
    const yes = deriveShowActions({ ...base, subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: true });
    const no = deriveShowActions({ ...base, subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(yes.showTrialCta).toBe(true);
    expect(no.showTrialCta).toBe(false);
  });

  // DELETE this test:
  it("shows subscribe-now when trialing, not upgrade", () => {
    const r = deriveShowActions({ ...base, subStatus: "trialing", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showSubscribeNow).toBe(true);
    expect(r.showUpgrade).toBe(false);
  });

  // UPDATE this test — remove showSubscribeNow assertion:
  it("shows switch-to-yearly when trialing and monthly", () => {
    const r = deriveShowActions({ ...base, subStatus: "trialing", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(true);
    // showSubscribeNow no longer exists — removed
  });
  ```

  Also update the `convertTrial` test — remove the `showTrialCta` assertion:

  ```typescript
  it("shows convertTrial when trial ended and plan reverted to free", () => {
    const r = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false, rawSub: { plan: "business", wasTrial: true } });
    expect(r.showConvertTrial).toBe(true);
    expect(r.showUpgrade).toBe(false);
    // showTrialCta no longer exists — removed
  });
  ```

- [ ] **Step 2: Run tests to confirm failure**

  ```bash
  cd apps/web && pnpm test -- --run plan-summary-card
  ```

  Expected: TypeScript error or test failures referencing `showTrialCta`/`showSubscribeNow`.

- [ ] **Step 3: Update `deriveShowActions` in `plan-summary-card.tsx`**

  Remove `showTrialCta` and `showSubscribeNow` from the function:

  ```typescript
  // Before
  export function deriveShowActions({
    subStatus,
    currentPlan,
    billingInterval,
    trialEligible,
    rawSub,
  }: {
    subStatus: string | null;
    currentPlan: string;
    billingInterval: "monthly" | "yearly" | null;
    trialEligible: boolean;
    rawSub: { plan: SubscriptionPlan; wasTrial: boolean } | null;
  }) {
    const nextTier = NEXT_TIER[currentPlan as SubscriptionPlan] ?? null;
    const isActive =
      subStatus != null &&
      ["active", "trialing", "past_due"].includes(subStatus);
    const showSubscribeNow = subStatus === "trialing";

    const showConvertCanceled =
      subStatus === "canceled" && rawSub?.wasTrial === true;
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
      !showSubscribeNow &&
      (isActive || subStatus == null);
    const showSwitchYearly = isActive && billingInterval === "monthly";
    const showTrialCta =
      subStatus == null &&
      !showConvertTrial &&
      !showResubscribe &&
      trialEligible;

    return {
      showUpgrade,
      showSwitchYearly,
      showTrialCta,
      showSubscribeNow,
      showConvertTrial,
      showConvertCanceled,
      showResubscribe,
      nextTier,
      rawSub,
    };
  }

  // After
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

    const showConvertCanceled =
      subStatus === "canceled" && rawSub?.wasTrial === true;
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
  ```

  Note: `trialEligible` is removed from the parameter signature too. Also update the call sites for this function in the component (remove `trialEligible` from the call).

- [ ] **Step 4: Fix the call site in `PlanSummaryCard`**

  Find the `deriveShowActions({...})` call in the component and remove `trialEligible`:

  ```typescript
  // Before
  const {
    showUpgrade,
    showSwitchYearly,
    showTrialCta,
    showSubscribeNow,
    showConvertTrial,
    showConvertCanceled,
    showResubscribe,
    nextTier,
    rawSub,
  } = deriveShowActions({
    subStatus: sub?.status ?? null,
    currentPlan,
    billingInterval,
    trialEligible: summary?.trialEligible ?? false,
    rawSub: summary?.subscription ?? null,
  });

  // After
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
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  cd apps/web && pnpm test -- --run plan-summary-card
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/components/billing/plan-summary-card.tsx apps/web/src/components/billing/plan-summary-card.test.tsx
  git commit -m "refactor(billing): remove showTrialCta and showSubscribeNow from deriveShowActions"
  ```

---

## Task 5 — Remove `useStartTrial` and `useActivateTrial` from `use-billing.tsx`

**Files:**
- Modify: `apps/web/src/hooks/use-billing.tsx`

- [ ] **Step 1: Delete `useStartTrial` (lines ~126–154)**

  Remove the entire function:

  ```typescript
  // DELETE:
  export function useStartTrial(orgSlug: string) {
    const orgId = useOrgId();
    return useMutation({
      mutationFn: async ({ plan, interval }: { plan: SubscriptionPlan; interval: "monthly" | "yearly" }) => {
        if (!orgId) throw new Error("No active organization");
        const { data, error } = await authClient.subscription.upgrade({
          plan,
          referenceId: orgId,
          annual: interval === "yearly",
          customerType: "organization",
          metadata: { noCard: "true" },
          successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success`,
          cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
        });
        if (error) throw new Error(error.message);
        return data;
      },
      onSuccess: (data) => {
        if (data?.url) window.location.href = data.url;
      },
    });
  }
  ```

- [ ] **Step 2: Delete `useActivateTrial` (lines ~210–226)**

  Remove the entire function:

  ```typescript
  // DELETE:
  export function useActivateTrial(orgSlug: string) {
    return useMutation({
      mutationFn: async () => {
        const { data } = await api.post<{ url: string }>(
          `/billing/${orgSlug}/activate-trial`,
          {
            successUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=success`,
            cancelUrl: `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing?checkout=canceled`,
          },
        );
        return data;
      },
      onSuccess: (data) => {
        if (data?.url) window.location.href = data.url;
      },
    });
  }
  ```

- [ ] **Step 3: Run typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors in `use-billing.tsx`. If `plan-summary-card.tsx` still imports the deleted hooks, fix those imports (handled in Task 6).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/hooks/use-billing.tsx
  git commit -m "refactor(billing): remove useStartTrial and useActivateTrial — trial is now automatic"
  ```

---

## Task 6 — Simplify trial banner and remove all trial-related modals/handlers from `PlanSummaryCard`

**Files:**
- Modify: `apps/web/src/components/billing/plan-summary-card.tsx`

- [ ] **Step 1: Remove unused imports**

  Remove the following from the import in `plan-summary-card.tsx`:

  ```typescript
  // Remove these from the use-billing import:
  useActivateTrial,
  useStartTrial,
  ```

  Updated import:

  ```typescript
  import {
    useBillingSummary,
    useChangePlan,
    useCheckout,
    useOrgSubscription,
  } from "@/hooks/use-billing";
  ```

- [ ] **Step 2: Remove state variables**

  Inside `PlanSummaryCard`, delete these three `useState` declarations:

  ```typescript
  // DELETE:
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [activateTrialModalOpen, setActivateTrialModalOpen] = useState(false);
  ```

  Keep `switchYearlyModalOpen` — it is used on paid subscriptions (non-trial).

- [ ] **Step 3: Remove mutation hooks**

  Delete:

  ```typescript
  // DELETE:
  const startTrial = useStartTrial(orgSlug);
  const activateTrial = useActivateTrial(orgSlug);
  ```

- [ ] **Step 4: Remove handlers**

  Delete these three handlers:

  ```typescript
  // DELETE:
  function handleSubscribeNow() { ... }
  function confirmActivateTrial() { ... }
  function handleStartTrial() { ... }
  ```

- [ ] **Step 5: Remove `ConfirmSwitchYearlyModal`, `switchYearlyModalOpen`, and clean up `handleSwitchYearly`**

  The `ConfirmSwitchYearlyModal` was only ever triggered by the trial banner's "Switch to yearly" button (the `handleSwitchYearly` guard `if (sub?.status === "trialing") { setSwitchYearlyModalOpen(true) }`). Since that button is gone, the modal is now unreachable. Remove it all:

  ```typescript
  // DELETE the ConfirmSwitchYearlyModal component definition entirely

  // DELETE state:
  const [switchYearlyModalOpen, setSwitchYearlyModalOpen] = useState(false);

  // Simplify handleSwitchYearly — remove the trialing guard:
  // Before:
  function handleSwitchYearly() {
    if (sub?.status === "trialing") {
      setSwitchYearlyModalOpen(true);
      return;
    }
    confirmSwitchYearly();
  }

  // After:
  function handleSwitchYearly() {
    confirmSwitchYearly();
  }
  ```

  Also remove the `<ConfirmSwitchYearlyModal ... />` JSX at the bottom of the component's non-trial return.

- [ ] **Step 6: Simplify the trial render branch**

  Replace the entire `if (sub?.status === "trialing" || showConvertCanceled)` block with a read-only banner (no modal references):

  ```tsx
  if (sub?.status === "trialing" || showConvertCanceled) {
    return (
      <div className="overflow-hidden rounded-xl border border-violet-300 bg-linear-to-br from-violet-50 to-purple-50 dark:border-violet-700 dark:from-violet-950/40 dark:to-purple-950/40">
        <div className="flex items-center p-5">
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
              Business features active
            </p>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 6: Remove `showTrialCta`/`showSubscribeNow` remnants from the non-trial action row**

  In the non-trial summary card's action row, remove these two button blocks:

  ```tsx
  // DELETE:
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
  ```

  The outer `if` condition for the action row should also drop these flags:

  ```tsx
  // Before
  {(showUpgrade || showSwitchYearly || showTrialCta || showConvertTrial || showResubscribe || showConvertCanceled) && (

  // After
  {(showUpgrade || showSwitchYearly || showConvertTrial || showResubscribe || showConvertCanceled) && (
  ```

- [ ] **Step 7: Delete the `TrialModal` component and its JSX usage**

  Remove the `TrialModal` component definition (the whole function) and its usage at the bottom of `PlanSummaryCard`:

  ```tsx
  // DELETE the component definition:
  function TrialModal({ ... }) { ... }

  // DELETE this usage at the bottom of PlanSummaryCard:
  <TrialModal
    open={trialModalOpen}
    onClose={() => setTrialModalOpen(false)}
    onStartTrial={handleStartTrial}
    isStartingTrial={startTrial.isPending}
    isCheckingOut={checkout.isPending}
  />
  ```

- [ ] **Step 8: Run typecheck and tests**

  ```bash
  pnpm typecheck
  cd apps/web && pnpm test -- --run plan-summary-card
  ```

  Expected: no type errors, all tests pass.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/web/src/components/billing/plan-summary-card.tsx
  git commit -m "feat(billing): simplify trial banner to read-only countdown — remove Subscribe Now and Try Business Free"
  ```

---

## Task 7 — Final typecheck and test run

- [ ] **Step 1: Full typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 2: All frontend tests**

  ```bash
  cd apps/web && pnpm test
  ```

  Expected: all tests pass.

- [ ] **Step 3: All API tests**

  ```bash
  cd apps/api && pnpm test
  ```

  Expected: all tests pass.
