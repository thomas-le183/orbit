# Trial Flow Design

**Date:** 2026-04-28  
**Status:** Approved

## Overview

Allow organizations to trial the Business plan once. Two entry points:

- **7-day, no card required** — Stripe subscription created directly with a 7-day trial period; Stripe cancels automatically if no payment method is added before expiry.
- **30-day, card required** — Standard Stripe Checkout session with 30 trial days injected automatically when the org is trial-eligible.

Both paths are one-time per org. Once either trial starts, the org is no longer eligible.

---

## Database

Add one nullable column to `organizationBilling`:

```sql
trial_used_at  timestamp  nullable  default null
```

- `null` → org has never trialed, eligible
- non-null → trial has been used, not eligible again

No additional tables required.

---

## Backend

### New endpoint — `POST /billing/:orgSlug/start-trial`

Starts the 7-day no-card trial.

**Authorization:** org membership required, owner or admin role.

**Guards (400 if violated):**
- `trialUsedAt` is not null (already trialed)
- Org has an existing active or trialing Stripe subscription

**Steps:**
1. Get or create Stripe customer for the org.
2. Create Stripe subscription directly (not via Checkout) with:
   - Price lookup key: `business_monthly`
   - `trial_period_days: 7`
   - `trial_settings.end_behavior.missing_payment_method: "cancel"`
3. Call `upsertSubscription()` with the Stripe subscription response.
4. Set `trialUsedAt = now()` on `organizationBilling`.
5. Return `{ status: "trialing" }`.

### Modified checkout — `POST /billing/:orgSlug/checkout`

Injects trial days for eligible orgs checking out on the Business plan.

- If `plan === "business"` AND `trialUsedAt` is null → add `subscription_data.trial_period_days: 30` to the Stripe Checkout session.
- No change for other plans or already-trialed orgs.

### Webhook — `upsertSubscriptionFromStripe`

When the upserted subscription has `status: "trialing"` and `organizationBilling.trialUsedAt` is null → set `trialUsedAt = now()`.

This covers the 30-day checkout path (since `start-trial` sets `trialUsedAt` synchronously for the 7-day path).

### Modified subscription response — `GET /billing/:orgSlug/subscription`

Add `trialEligible: boolean` to `SubscriptionResponse`:

```ts
trialEligible: trialUsedAt === null
```

`trialUsedAt` being non-null already covers all cases where a trial was ever started, including orgs that trialed and later canceled.

---

## Frontend

### New hook — `useStartTrial(orgSlug)`

Mutation calling `POST /billing/:orgSlug/start-trial`. On success: invalidates the subscription query, shows a success toast.

### Modified `SubscriptionSection`

Upgrade button logic when `showUpgrade` and `nextTier === "business"`:

**Trial eligible (`data.trialEligible === true`):**
- "Start 7-day free trial" → calls `useStartTrial`, no redirect
- "Try 30 days free" → calls existing `useCheckout({ plan: "business", interval: "monthly" })`; backend injects trial days

**Trial not eligible:**
- Existing "Upgrade to Business" button, unchanged

### Trial days-remaining display

When `status === "trialing"` and `currentPlan === "business"`, show inside the subscription card grid:

```
Days remaining   X days
```

Calculated as `Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86_400_000)`.

The existing "Subscribe now" button handles conversion for all trialing users — no changes needed.

---

## Error states

| Condition | Behavior |
|---|---|
| `start-trial` called when already trialed | `400 Bad Request` |
| `start-trial` called with active subscription | `400 Bad Request` |
| Stripe subscription creation fails | `500`, surface toast on frontend |
| 7-day trial expires, no card | Stripe cancels subscription → webhook sets status `canceled` → plan reverts to `free` |
| 30-day trial expires, card on file | Stripe auto-charges → webhook sets status `active` |
| 30-day trial expires, card declined | Stripe sets `past_due` → existing past-due alert shown |

---

## Out of scope

- Email reminders before trial expiry (Stripe can send these via its built-in dunning emails)
- Extending or pausing trials
- Per-seat trial pricing
- Enterprise trial
