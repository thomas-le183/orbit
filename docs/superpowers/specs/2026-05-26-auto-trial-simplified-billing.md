# Auto-Trial on Workspace Creation + Simplified Trial UI

**Date:** 2026-05-26

## Overview

Every new organization automatically receives a 14-day Business trial at creation time. No manual "Try Business free" button is required. During the trial the billing page is read-only (countdown only, no CTAs). When the trial expires the org reverts to the Free plan and can upgrade via the normal paid checkout flow.

---

## Behavior

### Trial lifecycle
1. Org created → 14-day Business trial starts immediately (backend, no user action)
2. Trial banner shows days remaining + plan name; no action buttons
3. Trial expires → status becomes `canceled` → plan resolves to `free`
4. Post-trial: user sees Free plan card with normal upgrade CTAs (Upgrade to Basic / Business)

### What is removed
- "Try Business free" button and `TrialModal`
- "Subscribe now" button (and the confirm-activate-trial dialog)
- "Switch to yearly" button from the trial banner
- `POST /billing/:orgSlug/activate-trial` API endpoint
- `freeTrial: { days: 7 }` from better-auth Business plan config (prevents double trials on paid checkout)

### What stays unchanged
- `showConvertCanceled` / `showConvertTrial` paths in `deriveShowActions` — existing orgs in edge states (canceled trial with remaining access) still surface the "Subscribe to Business" CTA in the non-trial summary card
- Normal paid upgrade flow (Basic / Business checkout) after trial expires
- "Switch to yearly" on active *paid* subscriptions (non-trial state, bottom of summary card)

---

## Backend

### `organization-billing-hooks.ts` — `afterCreateOrganization`
Add a fire-and-forget call to `autoStartTrial(org.id)` inside the existing `afterCreateOrganization` hook. Log errors; do not throw (org creation must not fail if billing setup fails).

### `billing.service.ts` — `autoStartTrial(orgId: string)`

```
1. Check if org already has a subscription row → if yes, skip (idempotent)
2. Resolve or create Stripe customer:
   a. Read organization.stripeCustomerId from DB
   b. If null: call stripe.customers.create({ name: org.name, metadata: { referenceId: orgId } })
   c. UPDATE organization SET stripeCustomerId = customer.id WHERE id = orgId
3. Resolve Business monthly price via getStripePriceByLookupKey(PLAN_LOOKUP_KEYS.business.monthly)
4. Create Stripe subscription:
   stripe.subscriptions.create({
     customer: customerId,
     items: [{ price: price.id, quantity: 1 }],
     trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
     payment_settings: { payment_method_collection: "if_required" },
     metadata: { referenceId: orgId, referenceType: "organization" },
   })
5. Insert subscription row:
   {
     plan: "business",
     referenceId: orgId,
     stripeCustomerId: customer.id,
     stripeSubscriptionId: stripeSub.id,
     status: "trialing",
     periodStart: now,
     periodEnd: now + 14 days,
     trialStart: now,
     trialEnd: now + 14 days,
     seats: 1,
     cancelAtPeriodEnd: false,
   }
```

The `stripeClient` dependency is already available via the `createOrganizationHooks` factory params. `autoStartTrial` needs `db` and `stripe` — pass them from the factory or add the method to `BillingService` and pass the service into the factory.

**Preferred approach:** add `autoStartTrial` to `BillingService` (already has both `db` and `stripe`). Pass the billing service into `createOrganizationHooks` alongside the existing params.

### `auth.ts` + `auth.module.ts` — remove `freeTrial`
Remove `freeTrial: { days: 7 }` from the Business plan entry in both files. Keep all other plan config identical (sync rule).

### `billing.controller.ts` + `billing.service.ts`
Delete `POST /:orgSlug/activate-trial` endpoint and the `activateTrial()` service method.

---

## Frontend

### `use-billing.tsx`
- Delete `useStartTrial` mutation
- Delete `useActivateTrial` mutation

### `plan-summary-card.tsx`

**`deriveShowActions`**
- Remove `showTrialCta` output
- Remove `showSubscribeNow` output
- `showSwitchYearly` is still computed but only shown on paid (non-trial) subscriptions — leave the computation, remove it from the trial banner render path

**Trial render path** (the `if (sub?.status === "trialing" || showConvertCanceled)` branch)
- Remove all buttons from the trial banner (Subscribe now, Switch to yearly)
- Remove `ConfirmSwitchYearlyModal` (only triggered from trial banner's Switch to yearly)
- Remove the `activateTrialModalOpen` state and its `Dialog`
- Banner becomes: Zap icon + "Trial" label + "X days left" + plan description line. No actions.

**Non-trial summary card action row**
- Remove `showTrialCta` CTA button (Try Business free)
- Remove `showSubscribeNow` CTA button
- Keep: `showConvertCanceled`, `showConvertTrial`, `showResubscribe`, `showUpgrade`, `showSwitchYearly`

**Imports / state**
- Remove `useStartTrial`, `useActivateTrial` imports
- Remove `trialModalOpen`, `activateTrialModalOpen` state vars
- Remove `handleStartTrial`, `handleSubscribeNow`, `confirmActivateTrial` handlers

---

## Files changed

| File | Change |
|------|--------|
| `apps/api/src/auth/organization-billing-hooks.ts` | Add `autoStartTrial` call in `afterCreateOrganization`; accept `billingService` param |
| `apps/api/src/billing/billing.service.ts` | Add `autoStartTrial(orgId)`; delete `activateTrial()` |
| `apps/api/src/billing/billing.controller.ts` | Delete `POST /:orgSlug/activate-trial` |
| `apps/api/src/auth/auth.ts` | Remove `freeTrial: { days: 7 }` from Business plan |
| `apps/api/src/auth/auth.module.ts` | Remove `freeTrial: { days: 7 }` from Business plan; pass `billingService` to hooks factory |
| `apps/web/src/hooks/use-billing.tsx` | Delete `useStartTrial`, `useActivateTrial` |
| `apps/web/src/components/billing/plan-summary-card.tsx` | Simplify trial banner (no buttons); remove trial-related modals and CTAs |

---

## Out of scope

- Switching plan/interval during trial (no CTAs during trial, so not applicable)
- Webhook handling changes (existing Stripe webhook flow handles trial expiry → canceled status → free plan, unchanged)
- Existing orgs with trials already in progress (not affected)
