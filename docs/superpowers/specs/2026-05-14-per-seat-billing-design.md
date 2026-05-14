# Per-Seat Billing Design

**Date:** 2026-05-14  
**Status:** Approved

## Overview

Implement pure per-seat billing for paid plans (Basic, Business). Stripe subscription quantity is always the source of truth for active seat count. Free plan has unlimited members with no Stripe seat tracking. When a paid-plan owner invites a member, a Linear-style confirmation dialog shows the per-seat cost before the invite is sent. Stripe quantity syncs automatically when members join or are removed.

## Decisions

- **Model**: Pure per-seat. No fixed seat cap on any plan. Price = $X × active member count.
- **Free plan**: Unlimited members, no Stripe seat tracking.
- **Paid plans**: Unlimited members, Stripe `subscription.quantity` = active member count at all times.
- **Seat timing**: Stripe quantity increments when the invitee **accepts** (not when invited). Quantity decrements when a member is **removed**.
- **Confirmation dialog**: Shown only on paid plans before sending the invite. Informational — no Stripe change at invite time.
- **Source of truth**: Stripe. We never store a seat count in our DB; we read `pricePerSeat` from Stripe prices and sync quantity via API calls.

## Section 1 — Config & data model

**`packages/shared/src/types/billing.ts`**

- All `memberLimit` values stay `-1` (unlimited for all plans — free and paid).
- Add `pricePerSeat: number | null` to `SubscriptionResponse`. Populated for paid plans (from Stripe), `null` for free.

No DB schema changes. `subscription.seats` column remains unused.

## Section 2 — Backend: Stripe sync via Better Auth hooks

**`apps/api/src/auth/auth.module.ts`** — fill in three existing empty hooks inside `organizationHooks`:

### `afterAcceptInvitation`

Fires after a user accepts an invitation and becomes a member. Updates Stripe subscription quantity to the current live member count.

```
1. Query subscription for org.id
2. If no subscription or plan === 'free', return early
3. Count active members for org.id (SELECT COUNT from member table)
4. Retrieve Stripe subscription to get items[0].id
5. Call stripe.subscriptions.update with { items: [{ id, quantity: memberCount }], proration_behavior: 'always_invoice' }
```

### `afterRemoveMember`

Fires after a member is removed. Same logic as above — member count has already decremented, so the live count is correct.

```
1. Query subscription for org.id
2. If no subscription or plan === 'free', return early
3. Count active members for org.id
4. Retrieve Stripe subscription to get items[0].id
5. Call stripe.subscriptions.update with { items: [{ id, quantity: memberCount }], proration_behavior: 'create_prorations' }
```

Note: use `always_invoice` on add (immediate charge for new seat) and `create_prorations` on remove (credit on next invoice).

### `afterCreateOrganization`

Already implemented (sends welcome email). No change.

## Section 3 — Backend: seat preview in billing controller

**`apps/api/src/billing/billing.controller.ts`** — `GET /billing/:orgSlug/subscription`

Add `pricePerSeat` to the response:

- For paid plans: look up the per-seat unit amount from Stripe using the subscription's `billingInterval` and the plan's lookup key. Divide by 100 (cents → dollars).
- For free plan: return `null`.

This reuses the existing Stripe prices fetch already done in `BillingService.getPlans()`. Extract a shared helper `getPricePerSeat(plan, billingInterval)` in `BillingService`.

**`packages/shared/src/types/billing.ts`** — update `SubscriptionResponse`:

```typescript
export interface SubscriptionResponse {
  // ... existing fields
  pricePerSeat: number | null; // USD per seat per billing interval, null for free
}
```

## Section 4 — Frontend: Linear-style invite modal

**`apps/web/src/components/workspace/settings/invite-member-modal.tsx`**

Add a two-step flow. Step 2 only appears for paid plans.

### Step 1 (unchanged)
Email + role form. "Send invite" button label stays the same.

### Step 2 — Confirmation (paid plans only)

When the user clicks "Send invite" on a paid plan, instead of immediately calling `inviteMember`, transition to a confirmation view within the same dialog:

```
Add a seat?

Inviting colleague@example.com will add 1 seat to your
subscription.

$X / seat / month · prorated on your next invoice

[Back]  [Confirm & invite]
```

"Confirm & invite" calls `authClient.organization.inviteMember` as today.

### Data source

`pricePerSeat` and `plan` come from `useSubscription(orgSlug)` (already loaded on the members settings page via `useBilling` hook). Pass them as props to `InviteMemberModal`.

### Free plan behavior

Step 2 is skipped entirely. "Send invite" on step 1 fires immediately.

## Error handling

- If `afterAcceptInvitation` Stripe call fails, log the error but do not block the member from joining. The seat count can be reconciled manually or via a future background sync.
- If `afterRemoveMember` Stripe call fails, same — log and continue. Member is still removed from the org.
- If Stripe returns an error on the update (e.g. card declined), it surfaces on the next invoice — not at invite time. This is acceptable for MVP.

## Out of scope

- Bulk seat purchase UI ("add 5 seats at once")
- Seat reconciliation / audit log
- Overage alerts or approaching-limit warnings
- Downgrade enforcement (removing members when downgrading plans)
