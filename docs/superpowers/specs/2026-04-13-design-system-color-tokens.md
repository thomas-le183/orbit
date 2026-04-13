# Design System Color Tokens — Spec

**Date:** 2026-04-13
**Status:** Approved

## Context

The existing `globals.css` VS Code 2026 token set covers core palette and sidebar chrome but is missing interactive-state granularity. Two problems:

1. `--nav-chrome-*` tokens have the wrong inactive tab foreground values — they use the "window unfocused" muted values instead of the normal readable inactive values.
2. The naming namespace `nav-chrome` conflates the tab strip and interactive button states in a confusing way.

This spec defines:
- A rename of `--nav-chrome-*` → `--nav-tab-*` with corrected color values
- New `--list-*` tokens for interactive list/tree row states

`--sidebar-*` tokens are out of scope and remain unchanged.

---

## Token Design

### Nav Tab tokens (`--nav-tab-*`)

Replaces every `--nav-chrome-*` token 1-to-1 (plus new tokens).

| CSS Variable | Purpose | Light (oklch) | Light ref | Dark (oklch) | Dark ref |
|---|---|---|---|---|---|
| `--nav-tab` | Tab strip / rail background | `oklch(0.986 0.004 286)` | `#FAFAFD` | `oklch(0.217 0.003 248)` | `#191A1B` |
| `--nav-tab-fg` | Normal inactive tab fg (readable) | `oklch(0.489 0 0)` | `#606060` | `oklch(0.640 0 0)` | `#8C8C8C` |
| `--nav-tab-hover` | Tab hover background | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 9%)` | — |
| `--nav-tab-btn-hover` | Icon button hover in bar | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 9%)` | — |
| `--nav-tab-btn-active` | Icon button pressed state | `oklch(0 0 0 / 18%)` | — | `oklch(1 0 0 / 22%)` | — |
| `--nav-tab-active` | Active tab background | `oklch(1 0 0)` | `#FFFFFF` | `oklch(0.186 0.003 248)` | `#121314` |
| `--nav-tab-active-fg` | Active tab foreground | `oklch(0.244 0 0)` | `#202020` | `oklch(0.805 0 0)` | `#bfbfbf` |
| `--nav-tab-active-border` | Active tab indicator line | `oklch(0.529 0.174 255)` | `#0069CC` | `oklch(0.630 0.104 231)` | `#3994BC` |
| `--nav-tab-unfocused-fg` | Inactive fg when window unfocused | `oklch(0.792 0 0)` | `#BBBBBB` | `oklch(0.337 0 0)` | `#444444` |

**Key fixes vs. current state:**
- `--nav-tab-fg` (was `--nav-chrome-tab-inactive-fg`): Light `#BBBBBB` → `#606060`, Dark `#444444` → `#8C8C8C`. These were the "unfocused window" values used in the wrong slot.
- `--nav-tab-active-border`: Light `#000000` → `#0069CC`. Black was harsh and inconsistent with dark mode's blue accent.
- `--nav-tab-unfocused-fg` is a new token that takes the old "muted" values that were incorrectly assigned to inactive.
- Old `--nav-chrome-hover` → `--nav-tab-btn-hover`, old `--nav-chrome-active` → `--nav-tab-btn-active`.

---

### List item tokens (`--list-*`)

New tokens for interactive list/tree row states. Not applied to sidebar immediately — available for command palette, search results, tree views, and future sidebar migration.

| CSS Variable | Purpose | Light (oklch) | Light ref | Dark (oklch) | Dark ref |
|---|---|---|---|---|---|
| `--list-hover` | Row hover background | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 5%)` | — |
| `--list-active` | Keyboard-focused row bg | `oklch(0 0 0 / 10%)` | — | `oklch(1 0 0 / 8%)` | — |
| `--list-active-fg` | Keyboard-focused row fg | `oklch(0.244 0 0)` | `#202020` | `oklch(0.943 0 0)` | `#ededed` |
| `--list-selection` | Selected row bg (panel focused) | `oklch(0.529 0.174 255 / 10%)` | `#0069CC1A` | `oklch(0.630 0.104 231 / 15%)` | `#3994BC26` |
| `--list-selection-fg` | Selected row fg (panel focused) | `oklch(0.244 0 0)` | `#202020` | `oklch(0.943 0 0)` | `#ededed` |
| `--list-inactive-selection` | Selected row bg (panel unfocused) | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 5%)` | — |
| `--list-inactive-selection-fg` | Selected row fg (panel unfocused) | `oklch(0.489 0 0)` | `#606060` | `oklch(0.640 0 0)` | `#8C8C8C` |

---

## Files Changed

### `packages/ui/src/styles/globals.css`

1. In `@theme inline`: rename `--color-nav-chrome-*` entries → `--color-nav-tab-*`, add `--color-nav-tab-btn-hover`, `--color-nav-tab-btn-active`, `--color-nav-tab-unfocused-fg`. Add `--color-list-*` block.
2. In `:root`: replace `--nav-chrome-*` variable declarations with `--nav-tab-*`. Fix color values as per table above.
3. In `.dark`: same rename + fix.

### `apps/web/src/components/workspace/app-nav.tsx`

- Replace every `nav-chrome-*` Tailwind class with the corresponding `nav-tab-*` class.
- Remove the `/60` opacity hack on inactive fg — use `text-nav-tab-fg` directly (correct value is now readable without faking it with opacity).

---

## Out of Scope

- `--sidebar-*` tokens — unchanged
- `packages/ui/src/components/sidebar.tsx` — unchanged
- All other components — unchanged
- Applying `--list-*` tokens to any component (tokens defined, wiring is future work)
