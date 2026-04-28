# Billing Module Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four bugs in the billing module: missing org-membership authorization, plain-Error throws, missing Stripe subscription metadata, and a stale checkout query param.

**Architecture:** Authorization is added inline in the controller using a new `BillingService.getOrgMember()` helper that queries the `member` table — same pattern used in `ChannelsService.getOrgRole()`. The other three fixes are local, single-file changes.

**Tech Stack:** NestJS, Drizzle ORM, Stripe SDK, React / TanStack Router

---

### Task 1: Add `getOrgMember` helper to BillingService

**Files:**
- Modify: `apps/api/src/billing/billing.service.ts`

The `member` table has `userId`, `organizationId`, and `role`. We need a method that returns the member record (or `null`) so the controller can decide whether to forbid.

- [ ] **Step 1: Add the method**

Open `apps/api/src/billing/billing.service.ts` and add this method after `getMemberCount` (around line 84):

```ts
async getOrgMember(userId: string, organizationId: string) {
  return this.db.query.member.findFirst({
    where: and(
      eq(schema.member.userId, userId),
      eq(schema.member.organizationId, organizationId),
    ),
  });
}
```

Also add `and` to the drizzle import at line 9:

```ts
import { and, count, eq } from "drizzle-orm";
```

- [ ] **Step 2: Run typecheck to verify**

```bash
cd /path/to/repo && pnpm typecheck 2>&1 | grep billing
```

Expected: no errors in billing files.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/billing/billing.service.ts
git commit -m "feat(billing): add getOrgMember helper for authorization checks"
```

---

### Task 2: Enforce org-membership authorization in BillingController

**Files:**
- Modify: `apps/api/src/billing/billing.controller.ts`

Rules:
- All four org-scoped endpoints (`getSubscription`, `createCheckout`, `changePlan`, `createPortal`) must verify the caller is a member of the org.
- Write endpoints (`createCheckout`, `changePlan`, `createPortal`) must additionally verify the member's role is `owner` or `admin`.
- Throw `ForbiddenException` (not `NotFoundException`) on failure so we don't leak whether the org exists.

- [ ] **Step 1: Add ForbiddenException import and CurrentUser to every endpoint**

Replace the top of `billing.controller.ts` imports:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
```

- [ ] **Step 2: Add `requireMember` and `requireAdminOrOwner` private helpers**

Add these two private methods at the bottom of the class (before the closing `}`):

```ts
private async requireMember(userId: string, orgId: string) {
  const member = await this.billingService.getOrgMember(userId, orgId);
  if (!member) throw new ForbiddenException("You are not a member of this organization");
  return member;
}

private async requireAdminOrOwner(userId: string, orgId: string) {
  const member = await this.requireMember(userId, orgId);
  if (member.role !== "owner" && member.role !== "admin") {
    throw new ForbiddenException("Only admins and owners can manage billing");
  }
}
```

- [ ] **Step 3: Add `@CurrentUser()` to `getSubscription` and add the member check**

```ts
@Get(":orgSlug/subscription")
async getSubscription(
  @Param("orgSlug") orgSlug: string,
  @CurrentUser() user: User,
): Promise<SubscriptionResponse> {
  const org = await this.billingService.getOrgBySlug(orgSlug);
  if (!org) throw new NotFoundException("Organization not found");

  await this.requireMember(user.id, org.id);

  const plan = await this.billingService.getOrgSubscriptionPlan(org.id);
  const subscription = await this.billingService.getSubscription(org.id);
  const memberCount = await this.billingService.getMemberCount(org.id);
  const metadata = PLAN_METADATA[plan];

  return {
    plan,
    planLabel: metadata.label,
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
}
```

- [ ] **Step 4: Add `requireAdminOrOwner` to `createCheckout`**

The endpoint already has `@CurrentUser() user: User`. Add the check right after the org lookup:

```ts
const org = await this.billingService.getOrgBySlug(orgSlug);
if (!org) throw new NotFoundException("Organization not found");

await this.requireAdminOrOwner(user.id, org.id);
```

- [ ] **Step 5: Add `@CurrentUser()` and `requireAdminOrOwner` to `changePlan`**

```ts
@Post(":orgSlug/change-plan")
async changePlan(
  @Param("orgSlug") orgSlug: string,
  @Body() body: { plan: SubscriptionPlan; interval: "monthly" | "yearly" },
  @CurrentUser() user: User,
): Promise<{ success: boolean }> {
  const { plan, interval } = body;
  if (plan === "free" || plan === "enterprise") {
    throw new BadRequestException("Cannot change to this plan via this endpoint");
  }

  const org = await this.billingService.getOrgBySlug(orgSlug);
  if (!org) throw new NotFoundException("Organization not found");

  await this.requireAdminOrOwner(user.id, org.id);

  await this.billingService.changeOrgSubscriptionPlan(org.id, plan, interval);
  return { success: true };
}
```

- [ ] **Step 6: Add `@CurrentUser()` and `requireAdminOrOwner` to `createPortal`**

```ts
@Post(":orgSlug/portal")
async createPortal(
  @Param("orgSlug") orgSlug: string,
  @CurrentUser() user: User,
): Promise<PortalResponse> {
  const org = await this.billingService.getOrgBySlug(orgSlug);
  if (!org) throw new NotFoundException("Organization not found");

  await this.requireAdminOrOwner(user.id, org.id);

  const billing = await this.billingService.getBillingRecord(org.id);
  if (!billing) {
    throw new BadRequestException(
      "No billing record found. Subscribe to a plan first.",
    );
  }

  const session = await this.stripeService.createPortalSession(
    billing.stripeCustomerId,
    orgSlug,
  );

  return { url: session.url };
}
```

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep billing
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/billing/billing.controller.ts
git commit -m "fix(billing): enforce org membership and role authorization on all billing endpoints"
```

---

### Task 3: Replace plain `Error` with NestJS exceptions in BillingService

**Files:**
- Modify: `apps/api/src/billing/billing.service.ts`

- [ ] **Step 1: Add BadRequestException import**

Add to the imports at the top of `billing.service.ts`:

```ts
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
```

- [ ] **Step 2: Replace the two plain throws in `changeOrgSubscriptionPlan`**

Find (around line 158):

```ts
if (!sub?.stripeSubscriptionId) throw new Error("No active subscription to change");
```

Replace with:

```ts
if (!sub?.stripeSubscriptionId) throw new BadRequestException("No active subscription to change");
```

Find:

```ts
if (!newLookupKey) throw new Error("Invalid plan or interval");
```

Replace with:

```ts
if (!newLookupKey) throw new BadRequestException("Invalid plan or interval");
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep billing
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/billing/billing.service.ts
git commit -m "fix(billing): use BadRequestException instead of plain Error in changeOrgSubscriptionPlan"
```

---

### Task 4: Add `subscription_data.metadata` to Stripe checkout session

**Files:**
- Modify: `apps/api/src/billing/stripe.service.ts`

Stripe subscription lifecycle webhooks (`customer.subscription.updated`, `customer.subscription.deleted`) are fired against the subscription object. The current webhook handler looks up the org via the customer → billing record path, but it's safer to also embed `organizationId` directly in the subscription metadata so the org is always recoverable.

- [ ] **Step 1: Add `subscription_data.metadata` to `createCheckoutSession`**

Find the `stripe.checkout.sessions.create` call in `stripe.service.ts` and add `subscription_data`:

```ts
return this.stripe.checkout.sessions.create({
  customer: customerId,
  mode: "subscription",
  line_items: [{ price: price.id, quantity: seatCount }],
  subscription_data: {
    metadata: { organizationId },
  },
  success_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=success`,
  cancel_url: `${webBaseUrl}/${orgSlug}/settings/billing?checkout=canceled`,
  client_reference_id: organizationId,
});
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep stripe
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/billing/stripe.service.ts
git commit -m "fix(billing): embed organizationId in Stripe subscription metadata for webhook reliability"
```

---

### Task 5: Clear `?checkout` query param after showing toast

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx`

The `useEffect` fires toasts on `?checkout=success` / `?checkout=canceled` but never removes the param, so refreshing or sharing the URL re-fires the toast.

- [ ] **Step 1: Add `useNavigate` and clear the param after the toast**

Replace the `useEffect` block (around line 24):

```ts
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
```

Then replace the `useEffect`:

```ts
const navigate = useNavigate();

useEffect(() => {
  if (!checkoutResult) return;
  if (checkoutResult === "success") {
    toast.success("Subscription activated! Welcome to your new plan.");
  } else if (checkoutResult === "canceled") {
    toast.info("Checkout canceled. No changes were made.");
  }
  navigate({ search: {} });
}, [checkoutResult]);
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep billing
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_workspace/\$orgSlug/settings/billing.tsx
git commit -m "fix(billing): clear checkout query param after showing toast to prevent replay on refresh"
```

---

## Self-Review

**Spec coverage:**
- Issue 1 (no org auth) → Tasks 1 & 2 ✓
- Issue 2 (plain Error → 500) → Task 3 ✓
- Issue 3 (missing subscription metadata) → Task 4 ✓
- Issue 4 (stale query param) → Task 5 ✓

**Placeholder scan:** No TBDs or placeholder steps. All code is complete.

**Type consistency:**
- `getOrgMember` defined in Task 1, called in Task 2 — matches.
- `requireMember` / `requireAdminOrOwner` defined and used within Task 2 — matches.
- `BadRequestException` added to imports before use in Task 3 — matches.
- `useNavigate` imported before use in Task 5 — matches.
