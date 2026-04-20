# Stripe & Feature Flags — Frontend Design

**Date:** 2026-04-20
**Scope:** Frontend only. Backend (Stripe module, webhooks, DB schema) is already production-ready.

---

## Context

The API already exposes:

- `GET /billing/:orgSlug/subscription` → `SubscriptionResponse` (tier, member usage, subscription status)
- `POST /billing/:orgSlug/checkout` → redirects to Stripe Checkout
- `POST /billing/:orgSlug/portal` → redirects to Stripe Customer Portal

Four tiers are defined in `@orbit/shared`: `free` (Hobby), `team` (Startup, $19), `pro` (Business, $59), `enterprise` ($199). Each tier carries three feature flags: `hasAdvancedAnalytics`, `hasCustomBranding`, `hasSSO`.

The billing settings route (`_workspace/$orgSlug/settings/billing.tsx`) is currently a "Coming soon" stub.

---

## What We're Building

1. **Billing settings page** — current plan summary + full pricing table + Stripe portal access
2. **`useFeatureFlag` hook** — derives flag state from the cached subscription query, no extra network call
3. **`UpgradeGate` component** — wraps any UI element; disables it with a tooltip when the flag is off; clicking opens an upgrade modal

---

## Components

### `apps/web/src/hooks/use-feature-flag.ts`

```ts
useFeatureFlag(flag: keyof TierFlags): { enabled: boolean; requiredTier: SubscriptionTier }
```

- Reads `orgSlug` from `useParams({ from: '/_workspace/$orgSlug' })`
- Calls `useOrgSubscription(orgSlug)` (already cached by TanStack Query)
- Looks up `TIER_METADATA[tier].flags[flag]` to derive `enabled`
- `requiredTier` is the lowest tier where the flag is `true` (used in upgrade prompts)
- **Fail-open:** returns `enabled: true` while loading or on error — a network blip must not disable UI

### `apps/web/src/components/billing/upgrade-gate.tsx`

Props: `flag: keyof TierFlags`, `children: ReactNode`, optional `message?: string`

- Reads `orgSlug` internally via `useParams`
- If `enabled`: renders children normally
- If `!enabled`: wraps children in a `div` with `pointer-events-none opacity-50`, overlays a `Tooltip` with the upgrade message, and on click opens `UpgradeModal`
- Tooltip default text: *"Available on [Tier] and above. Click to upgrade."*

Usage:

```tsx
<UpgradeGate flag="hasCustomBranding">
  <BrandingSettings />
</UpgradeGate>
```

### `apps/web/src/components/billing/upgrade-modal.tsx`

- Dialog containing `PricingTable`
- Receives `highlightTier` (the required tier) to visually emphasise the minimum upgrade path
- Passes `onSelectTier` → calls `useCheckout(orgSlug).mutate(tier)` → redirects to Stripe Checkout

### `apps/web/src/components/billing/pricing-table.tsx`

- Tailark `pricing-3` block installed via `pnpm dlx shadcn add @tailark/pricing-3` — the raw block lands in `packages/ui/src/components/` (shadcn's configured output path)
- `pricing-table.tsx` in `apps/web` wraps that block and adapts it to render all 4 tiers from `TIER_METADATA`
- Receives `currentTier` to highlight the active plan and disable the "Get started" button on it
- Receives optional `highlightTier` to badge a specific plan (used from `UpgradeModal`)
- "PRO" (Business) tier badged as "Most popular" by default
- Clicking a paid tier calls `onSelectTier(tier)` — FREE tier shows "Current plan" or "Downgrade" with no checkout action

### `apps/web/src/components/billing/current-plan-card.tsx`

Displays:

- Current tier label + badge
- Member usage bar: `current / limit` (shows "Unlimited" when `limit === -1`)
- Subscription status (active / past_due / canceled) and renewal date when applicable
- "Manage subscription" button → `usePortal(orgSlug).mutate()` — hidden when `subscription` is null (FREE tier with no Stripe subscription)

### `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx`

Layout:

1. `CurrentPlanCard` at the top
2. `PricingTable` below, full width — shows all tiers, current one highlighted

---

## Error Handling

| Scenario | Behaviour |
| --- | --- |
| Subscription query loading | `UpgradeGate` fails open (`enabled: true`); billing page shows skeleton |
| Subscription query error | Same fail-open; billing page shows error state with retry |
| `useCheckout` returns `url: null` | Show Sonner toast: *"Could not start checkout. Please try again."* |
| `usePortal` fails | Show Sonner toast: *"Could not open billing portal."* |
| FREE tier (no subscription row) | `subscription` is null — hide "Manage subscription" button; pricing table shows all tiers |

---

## File Summary

| File | Action |
| --- | --- |
| `pnpm dlx shadcn add @tailark/pricing-3` | Installs Tailark block into `packages/ui` |
| `apps/web/src/hooks/use-feature-flag.ts` | New hook |
| `apps/web/src/components/billing/upgrade-gate.tsx` | New component |
| `apps/web/src/components/billing/upgrade-modal.tsx` | New component |
| `apps/web/src/components/billing/pricing-table.tsx` | New component (wraps Tailark block) |
| `apps/web/src/components/billing/current-plan-card.tsx` | New component |
| `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx` | Replace stub |
