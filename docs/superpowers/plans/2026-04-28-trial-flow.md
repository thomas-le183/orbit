# Trial Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow organizations to trial the Business plan once — 7 days with no card, or 30 days via Stripe Checkout with card.

**Architecture:** Add `trialUsedAt` to `organizationBilling` to enforce one-time-per-org eligibility. A new `POST /billing/:orgSlug/start-trial` endpoint creates a Stripe subscription directly (no checkout) with `trial_period_days: 7` and auto-cancel on missing payment. Checkout for Business injects `trial_period_days: 30` when eligible. Both paths set `trialUsedAt` via `upsertSubscription`. Frontend shows two trial entry buttons when eligible, and days-remaining when trialing.

**Tech Stack:** NestJS, Drizzle ORM (PostgreSQL), Stripe Node SDK, React + TanStack Query, TypeScript

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/api/src/db/schema/billing.ts` |
| Modify | `packages/shared/src/types/billing.ts` |
| Modify | `apps/api/src/billing/stripe.service.ts` |
| Modify | `apps/api/src/billing/billing.service.ts` |
| Create | `apps/api/src/billing/billing.service.spec.ts` |
| Modify | `apps/api/src/billing/billing.controller.ts` |
| Modify | `apps/web/src/hooks/use-billing.tsx` |
| Modify | `apps/web/src/components/billing/subscription-section.tsx` |

---

## Task 1: Add `trialUsedAt` to DB schema and generate migration

**Files:**
- Modify: `apps/api/src/db/schema/billing.ts`

- [ ] **Step 1: Add `trialUsedAt` column to `organizationBilling`**

  In `apps/api/src/db/schema/billing.ts`, update the `organizationBilling` table:

  ```typescript
  export const organizationBilling = pgTable("organization_billing", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    trialUsedAt: timestamp("trial_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  });
  ```

- [ ] **Step 2: Generate the migration**

  ```bash
  cd apps/api && pnpm db:generate
  ```

  Expected: a new file appears in `apps/api/drizzle/` with `ALTER TABLE organization_billing ADD COLUMN trial_used_at timestamp`.

- [ ] **Step 3: Apply the migration**

  ```bash
  pnpm db:migrate
  ```

  Expected: migration runs without error.

- [ ] **Step 4: Typecheck**

  ```bash
  cd ../.. && pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/db/schema/billing.ts apps/api/drizzle/
  git commit -m "feat(billing): add trialUsedAt column to organizationBilling"
  ```

---

## Task 2: Add `trialEligible` to `SubscriptionResponse` shared type

**Files:**
- Modify: `packages/shared/src/types/billing.ts`

- [ ] **Step 1: Add `trialEligible` to the interface**

  In `packages/shared/src/types/billing.ts`, update `SubscriptionResponse`:

  ```typescript
  export interface SubscriptionResponse {
    plan: SubscriptionPlan;
    planLabel: string;
    trialEligible: boolean;
    usage: {
      members: {
        current: number;
        limit: number;
      };
    };
    subscription: {
      status: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      cancelAtPeriodEnd: boolean;
    } | null;
  }
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: TypeScript errors appear in `billing.controller.ts` because `trialEligible` is now required in the return object. That is expected — Task 6 fixes it.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/shared/src/types/billing.ts
  git commit -m "feat(billing): add trialEligible to SubscriptionResponse type"
  ```

---

## Task 3: Add `createTrialSubscription` to `StripeService`

**Files:**
- Modify: `apps/api/src/billing/stripe.service.ts`

- [ ] **Step 1: Add `createTrialSubscription` method**

  In `apps/api/src/billing/stripe.service.ts`, add after `createCheckoutSession`:

  ```typescript
  async createTrialSubscription(
    customerId: string,
    lookupKey: string,
    organizationId: string,
  ) {
    const price = await this.getPriceByLookupKey(lookupKey);
    if (!price) throw new Error(`No price found for lookup key: ${lookupKey}`);

    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      trial_period_days: 7,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      metadata: { organizationId },
      payment_settings: { save_default_payment_method: "on_subscription" },
    });
  }
  ```

- [ ] **Step 2: Add optional `trialDays` parameter to `createCheckoutSession`**

  Update the signature and body of `createCheckoutSession`:

  ```typescript
  async createCheckoutSession(
    customerId: string,
    lookupKey: string,
    seatCount: number,
    orgSlug: string,
    organizationId: string,
    trialDays?: number,
  ) {
    const price = await this.getPriceByLookupKey(lookupKey);
    if (!price) throw new Error(`No price found for lookup key: ${lookupKey}`);

    const webBaseUrl = this.config.getOrThrow<string>("WEB_BASE_URL");
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price.id, quantity: seatCount }],
      subscription_data: {
        metadata: { organizationId },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      success_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=success`,
      cancel_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=canceled`,
      client_reference_id: organizationId,
    });
  }
  ```

- [ ] **Step 3: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/billing/stripe.service.ts
  git commit -m "feat(billing): add createTrialSubscription and optional trialDays to checkout"
  ```

---

## Task 4: Add trial methods to `BillingService` + update `upsertSubscription`

**Files:**
- Modify: `apps/api/src/billing/billing.service.ts`
- Create: `apps/api/src/billing/billing.service.spec.ts`

- [ ] **Step 1: Write failing tests**

  Create `apps/api/src/billing/billing.service.spec.ts`:

  ```typescript
  import { BadRequestException } from "@nestjs/common";
  import { BillingService } from "./billing.service";

  const mockDb = {
    query: {
      organizationBilling: { findFirst: jest.fn() },
      subscription: { findFirst: jest.fn() },
    },
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  const mockStripe = {
    createCustomer: jest.fn(),
    createTrialSubscription: jest.fn(),
  };

  function makeService() {
    const svc = new BillingService(mockDb as any, mockStripe as any);
    return svc;
  }

  beforeEach(() => jest.clearAllMocks());

  describe("isTrialEligible", () => {
    it("returns true when no billing record exists", async () => {
      mockDb.query.organizationBilling.findFirst.mockResolvedValue(null);
      const svc = makeService();
      expect(await svc.isTrialEligible("org-1")).toBe(true);
    });

    it("returns true when trialUsedAt is null", async () => {
      mockDb.query.organizationBilling.findFirst.mockResolvedValue({
        trialUsedAt: null,
      });
      const svc = makeService();
      expect(await svc.isTrialEligible("org-1")).toBe(true);
    });

    it("returns false when trialUsedAt is set", async () => {
      mockDb.query.organizationBilling.findFirst.mockResolvedValue({
        trialUsedAt: new Date(),
      });
      const svc = makeService();
      expect(await svc.isTrialEligible("org-1")).toBe(false);
    });
  });

  describe("startTrial", () => {
    it("throws BadRequestException when trial already used", async () => {
      mockDb.query.organizationBilling.findFirst.mockResolvedValue({
        trialUsedAt: new Date(),
        stripeCustomerId: "cus_123",
        organizationId: "org-1",
        id: "b1",
      });
      const svc = makeService();
      await expect(svc.startTrial("org-1", "Acme", "user@test.com")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException when active subscription exists", async () => {
      mockDb.query.organizationBilling.findFirst.mockResolvedValue({
        trialUsedAt: null,
        stripeCustomerId: "cus_123",
        organizationId: "org-1",
        id: "b1",
      });
      mockDb.query.subscription.findFirst.mockResolvedValue({ status: "active" });
      const svc = makeService();
      await expect(svc.startTrial("org-1", "Acme", "user@test.com")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("creates trial subscription and marks trial used when eligible", async () => {
      mockDb.query.organizationBilling.findFirst.mockResolvedValue({
        trialUsedAt: null,
        stripeCustomerId: "cus_123",
        organizationId: "org-1",
        id: "b1",
      });
      mockDb.query.subscription.findFirst.mockResolvedValue(null);
      mockStripe.createTrialSubscription.mockResolvedValue({
        id: "sub_trial",
        status: "trialing",
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: "price_biz" },
              current_period_start: 1700000000,
              current_period_end: 1700604800,
            },
          ],
        },
      });

      const svc = makeService();
      await svc.startTrial("org-1", "Acme", "user@test.com");

      expect(mockStripe.createTrialSubscription).toHaveBeenCalledWith(
        "cus_123",
        "business_monthly",
        "org-1",
      );
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("upsertSubscription", () => {
    it("calls markTrialUsed when status is trialing", async () => {
      mockDb.query.subscription.findFirst.mockResolvedValue(null);
      mockDb.query.organizationBilling.findFirst.mockResolvedValue({
        trialUsedAt: null,
        organizationId: "org-1",
      });

      const svc = makeService();
      const markSpy = jest.spyOn(svc, "markTrialUsed").mockResolvedValue();

      await svc.upsertSubscription({
        organizationId: "org-1",
        stripeSubscriptionId: "sub_1",
        stripePriceId: "price_1",
        subscriptionPlan: "business",
        status: "trialing",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      expect(markSpy).toHaveBeenCalledWith("org-1");
    });

    it("does not call markTrialUsed when status is active", async () => {
      mockDb.query.subscription.findFirst.mockResolvedValue(null);

      const svc = makeService();
      const markSpy = jest.spyOn(svc, "markTrialUsed").mockResolvedValue();

      await svc.upsertSubscription({
        organizationId: "org-1",
        stripeSubscriptionId: "sub_1",
        stripePriceId: "price_1",
        subscriptionPlan: "business",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      });

      expect(markSpy).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd apps/api && pnpm test billing.service.spec.ts
  ```

  Expected: FAIL — `isTrialEligible`, `markTrialUsed`, and `startTrial` are not defined.

- [ ] **Step 3: Add `isTrialEligible` and `markTrialUsed` to `BillingService`**

  In `apps/api/src/billing/billing.service.ts`, add these two methods after `findBillingByCustomerId`:

  ```typescript
  async isTrialEligible(organizationId: string): Promise<boolean> {
    const billing = await this.getBillingRecord(organizationId);
    return billing?.trialUsedAt == null;
  }

  async markTrialUsed(organizationId: string): Promise<void> {
    await this.db
      .update(schema.organizationBilling)
      .set({ trialUsedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.organizationBilling.organizationId, organizationId),
          isNull(schema.organizationBilling.trialUsedAt),
        ),
      );
  }
  ```

  Also add `isNull` to the drizzle-orm import at the top of the file:

  ```typescript
  import { and, count, eq, isNull } from "drizzle-orm";
  ```

- [ ] **Step 4: Update `upsertSubscription` to call `markTrialUsed` when trialing**

  At the end of the `upsertSubscription` method (after the `if/else` block), add:

  ```typescript
  if (data.status === "trialing") {
    await this.markTrialUsed(data.organizationId);
  }
  ```

- [ ] **Step 5: Add `startTrial` method**

  Add after `upsertSubscription`:

  ```typescript
  async startTrial(
    organizationId: string,
    orgName: string,
    userEmail: string,
  ): Promise<void> {
    const billing = await this.getBillingRecord(organizationId);
    if (billing?.trialUsedAt) {
      throw new BadRequestException(
        "Trial has already been used for this organization",
      );
    }

    const existingSub = await this.getSubscription(organizationId);
    if (
      existingSub &&
      ["active", "trialing", "past_due"].includes(existingSub.status)
    ) {
      throw new BadRequestException(
        "Organization already has an active subscription",
      );
    }

    let billingRecord = billing;
    if (!billingRecord) {
      const customer = await this.stripeService.createCustomer(
        organizationId,
        orgName,
        userEmail,
      );
      billingRecord = await this.getOrCreateBillingRecord(
        organizationId,
        customer.id,
      );
    }

    const stripeSub = await this.stripeService.createTrialSubscription(
      billingRecord.stripeCustomerId,
      "business_monthly",
      organizationId,
    );

    const item = stripeSub.items.data[0];
    await this.upsertSubscription({
      organizationId,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: item.price.id,
      subscriptionPlan: "business",
      status: stripeSub.status,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    });
  }
  ```

- [ ] **Step 6: Run tests to verify they pass**

  ```bash
  pnpm test billing.service.spec.ts
  ```

  Expected: all tests PASS.

- [ ] **Step 7: Typecheck**

  ```bash
  cd ../.. && pnpm typecheck
  ```

  Expected: no new errors (the `SubscriptionResponse` error from Task 2 is still expected).

- [ ] **Step 8: Commit**

  ```bash
  git add apps/api/src/billing/billing.service.ts apps/api/src/billing/billing.service.spec.ts
  git commit -m "feat(billing): add isTrialEligible, markTrialUsed, startTrial to BillingService"
  ```

---

## Task 5: Add `start-trial` endpoint and update `getSubscription` + `createCheckout` in controller

**Files:**
- Modify: `apps/api/src/billing/billing.controller.ts`

- [ ] **Step 1: Add `POST :orgSlug/start-trial` endpoint**

  In `apps/api/src/billing/billing.controller.ts`, add this method before `createPortal`:

  ```typescript
  @Post(":orgSlug/start-trial")
  async startTrial(
    @Param("orgSlug") orgSlug: string,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    const org = await this.billingService.getOrgBySlug(orgSlug);
    if (!org) throw new NotFoundException("Organization not found");

    await this.requireAdminOrOwner(user.id, org.id);

    await this.billingService.startTrial(org.id, org.name, user.email);
    return { status: "trialing" };
  }
  ```

- [ ] **Step 2: Add `trialEligible` to `getSubscription` response**

  In `getSubscription`, update the return statement:

  ```typescript
  const trialEligible = await this.billingService.isTrialEligible(org.id);

  return {
    plan,
    planLabel: metadata.label,
    trialEligible,
    usage: {
      members: {
        current: memberCount,
        limit: metadata.memberLimit,
      },
    },
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  };
  ```

- [ ] **Step 3: Inject trial days into `createCheckout` for eligible Business checkouts**

  In `createCheckout`, replace the `const session = await ...` call with:

  ```typescript
  const trialEligible = await this.billingService.isTrialEligible(org.id);
  const trialDays = plan === "business" && trialEligible ? 30 : undefined;

  const session = await this.stripeService.createCheckoutSession(
    billing.stripeCustomerId,
    lookupKey,
    seatCount,
    orgSlug,
    org.id,
    trialDays,
  );
  ```

- [ ] **Step 4: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/billing/billing.controller.ts
  git commit -m "feat(billing): add start-trial endpoint and inject trial days into checkout"
  ```

---

## Task 6: Add `useStartTrial` hook to frontend

**Files:**
- Modify: `apps/web/src/hooks/use-billing.tsx`

- [ ] **Step 1: Add `useStartTrial` hook**

  In `apps/web/src/hooks/use-billing.tsx`, add after `useCheckout`:

  ```typescript
  export function useStartTrial(orgSlug: string) {
    return useMutation({
      mutationFn: async () => {
        const { data } = await api.post<{ status: string }>(
          `/billing/${orgSlug}/start-trial`,
        );
        return data;
      },
    });
  }
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/hooks/use-billing.tsx
  git commit -m "feat(billing): add useStartTrial hook"
  ```

---

## Task 7: Update `SubscriptionSection` with trial UI and days-remaining

**Files:**
- Modify: `apps/web/src/components/billing/subscription-section.tsx`

- [ ] **Step 1: Add `useStartTrial` import**

  Update the import from `@/hooks/use-billing`:

  ```typescript
  import {
    useChangePlan,
    useCheckout,
    useOrgSubscription,
    useStartTrial,
  } from "@/hooks/use-billing";
  ```

- [ ] **Step 2: Add `startTrial` mutation and `daysRemaining` derived value**

  Inside `SubscriptionSection`, after the `changePlan` line:

  ```typescript
  const startTrial = useStartTrial(orgSlug);
  ```

  After the `renewalLabel` line, add:

  ```typescript
  const daysRemaining =
    sub?.status === "trialing"
      ? Math.ceil(
          (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86_400_000,
        )
      : null;
  ```

- [ ] **Step 3: Add `handleStartTrial` function**

  After `handleUpgrade`, add:

  ```typescript
  function handleStartTrial() {
    startTrial.mutate(undefined, {
      onSuccess: () => {
        toast.success("Your 7-day Business trial has started!");
        invalidateSub();
      },
      onError: () => toast.error("Could not start trial. Please try again."),
    });
  }
  ```

- [ ] **Step 4: Add days-remaining row to the subscription card**

  Inside the card grid (after the Seats row), add:

  ```tsx
  {daysRemaining !== null && (
    <>
      <span className="text-muted-foreground">Trial ends</span>
      <span>
        {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
      </span>
    </>
  )}
  ```

- [ ] **Step 5: Replace the upgrade button section with trial-aware logic**

  Replace the `{showUpgrade && (...)}` block with:

  ```tsx
  {showUpgrade && (
    <>
      {nextTier === "business" && data.trialEligible ? (
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
  ```

- [ ] **Step 6: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/components/billing/subscription-section.tsx
  git commit -m "feat(billing): add trial entry buttons and days-remaining display to SubscriptionSection"
  ```
