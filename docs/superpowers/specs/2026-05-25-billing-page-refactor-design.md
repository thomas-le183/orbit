# Billing Page Refactor — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Goal

Refactor the billing settings page to be purpose-built for per-seat billing. The current page uses a generic subscription UI that doesn't communicate cost clearly. The new design makes the per-seat math explicit and prominent, fixes two functional bugs, and consolidates the data layer.

## Layout

Summary-first single-column layout (Linear-style). All critical billing info above the fold, actions inside the summary card, management and danger zone below.

Seat management (who holds which seat) stays on the Members settings page — billing shows count and cost only.

## Sections

### 1. Past-due alert (conditional)

Shown when `subscription.status === "past_due"`. Inline "Update payment method →" link that opens the Stripe portal directly. The portal button in section 3 must also remain **enabled** when past-due (currently incorrectly disabled).

### 2. Plan summary card

The centrepiece. Contains four sub-rows:

**Header row** — plan name + status badge (Active / Trial / Past due / Canceling) on the left; total monthly cost + next invoice date on the right.

**Cost equation row** — `[X seats] × [$Y / seat] = $Z / month [Monthly billing]`. Makes the per-seat calculation explicit and scannable. Chips for seat count and price link visually to the total.

**Stats row** — three columns: Seats used (member count), Price per seat, Renewal date.

**Actions row** — contextual buttons rendered inside the card footer:
- `Upgrade to Enterprise` (if on Business)
- `Upgrade to Business` (if on Basic)
- `Switch to yearly · save 17%` (if on monthly interval)
- `Subscribe now` (if trialing)

### 2a. Trial state (replaces summary card)

When `subscription.status === "trialing"`, show a purple gradient trial banner instead of the summary card:
- "⚡ Trial — N days left"
- Subtitle: "Business features active · no card on file"
- CTA: "Subscribe now" button

### 3. Payment & invoices

Label, short description, "Open billing portal" button. Button is **always enabled** (even past-due — this is how users fix payment issues).

### 4. Cancel subscription (conditional)

Only shown when `canCancel` is true (`sub` exists, status is active/trialing/past_due, `cancelAtPeriodEnd` is false). Red-bordered danger-zone card with period-end date. Opens existing confirmation modal on click.

## Data layer changes

### Bug fixes

1. **`useOrgSubscription` misses `past_due`** — add `"past_due"` to the `find` predicate so `sub` is populated for past-due orgs. Without this, `isPastDue` is always `false` and the alert never renders.

2. **`currentPlan` wrong for past-due orgs** — derive `currentPlan` from `summary.plan` (via `useBillingSummary`) rather than `data.subscription.plan` so past-due orgs don't show "free".

### Consolidation

`SubscriptionSection` currently calls both `useOrgSubscription` and `useBillingSummary`. The summary card needs:
- `billingInterval` → from `summary.billingInterval`
- `trialEligible` → from `summary.trialEligible`
- `pricePerSeat` → from `summary.pricePerSeat`
- `plan` → from `summary.plan`
- `stripeSubscriptionId` → still from `useOrgSubscription` (not in `SubscriptionResponse`)
- `memberCount` → prefer `summary.usage.members.current` (DB count) over `orgResult.data.members.length` (loads full member list)

Both hooks remain for now. `stripeSubscriptionId` is the only field that justifies keeping `useOrgSubscription`; a follow-up can add it to `SubscriptionResponse` and remove the dual-fetch.

## Component changes

| File | Change |
|------|--------|
| `billing.tsx` | Remove `SubscriptionSection` import; render new `PlanSummaryCard` + existing `BillingPortalSection` + `CancelSection`. Fix `isPastDue` logic (depends on bug fix #1). |
| `subscription-section.tsx` | Replace with `PlanSummaryCard` — tighter, single responsibility. Move modals into their own files. |
| `billing/plan-summary-card.tsx` | New component. Renders header row, cost equation row, stats row, actions row. Handles all subscription states (active, trialing, past_due, canceling, free). |
| `use-billing.tsx` | Fix `useOrgSubscription` `find` predicate to include `"past_due"`. Change `memberCount` to use `summary.usage.members.current` once billing summary is available. |

## States handled

| State | Summary card shows | Actions shown |
|-------|--------------------|---------------|
| Free (no sub) | Plan: Hobby, no cost row | Upgrade to Basic |
| Active monthly | Full cost equation | Upgrade (if not Enterprise), Switch to yearly |
| Active yearly | Full cost equation, no interval switch | Upgrade (if not Enterprise) |
| Trialing | Trial banner with countdown | Subscribe now |
| Past due | Summary card + past-due alert above | Manage payment (portal) |
| Canceling at period end | Summary card + amber canceling alert | — |
| Canceled | Summary card + red canceled alert | Resubscribe (upgrade) |

## Out of scope

- Invoice history table (available via Stripe portal)
- Seat management / member list (Members settings page)
- Yearly price display in cost equation (requires backend to expose yearly price per seat in `SubscriptionResponse`)
- Enterprise plan checkout (custom flow, not self-serve)
