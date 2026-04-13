# Design System Color Tokens — Spec

**Date:** 2026-04-13
**Status:** Approved

## Context

The existing `globals.css` VS Code 2026 token set covers core palette and sidebar chrome but has two problems:

1. `--nav-chrome-*` naming is verbose and conflates the strip background with tab states.
2. The "inactive" tab foreground is wired to the "window-unfocused" muted value — tabs appear near-invisible in normal use.

This spec defines:
- A rename of `--nav-chrome-*` → `--tab-*` with a clean per-state model (inactive, hover, active — each with bg + fg)
- New `--list-*` tokens for interactive list/tree row states

`--sidebar-*` tokens and `sidebar.tsx` are out of scope and remain unchanged.

---

## Token Design

### Tab tokens (`--tab-*`)

Replaces every `--nav-chrome-*` token. States are modelled explicitly with background and foreground for each.

| CSS Variable | Purpose | Light (oklch) | Light ref | Dark (oklch) | Dark ref |
|---|---|---|---|---|---|
| `--tab` | Strip / rail background | `oklch(0.986 0.004 286)` | `#FAFAFD` | `oklch(0.217 0.003 248)` | `#191A1B` |
| `--tab-inactive` | Inactive tab bg (transparent, blends to strip) | `transparent` | — | `transparent` | — |
| `--tab-inactive-fg` | Inactive tab fg — readable normal state | `oklch(0.489 0 0)` | `#606060` | `oklch(0.640 0 0)` | `#8C8C8C` |
| `--tab-hover` | Hover tab bg | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 9%)` | — |
| `--tab-hover-fg` | Hover tab fg | `oklch(0.244 0 0)` | `#202020` | `oklch(0.805 0 0)` | `#bfbfbf` |
| `--tab-active` | Active tab bg | `oklch(1 0 0)` | `#FFFFFF` | `oklch(0.186 0.003 248)` | `#121314` |
| `--tab-active-fg` | Active tab fg | `oklch(0.244 0 0)` | `#202020` | `oklch(0.805 0 0)` | `#bfbfbf` |
| `--tab-active-border` | Active indicator line | `oklch(0.529 0.174 255)` | `#0069CC` | `oklch(0.630 0.104 231)` | `#3994BC` |
| `--tab-unfocused-fg` | Inactive fg when window is unfocused | `oklch(0.792 0 0)` | `#BBBBBB` | `oklch(0.337 0 0)` | `#444444` |

**Key fixes vs. current `--nav-chrome-*` state:**
- `--tab-inactive-fg` (was `--nav-chrome-tab-inactive-fg`): Light `#BBBBBB` → `#606060`, Dark `#444444` → `#8C8C8C`. The old values were the "window unfocused" slot, used in the wrong place.
- `--tab-active-border`: Light `#000000` → `#0069CC`. Pure black was harsh and inconsistent with dark mode's blue.
- `--tab-unfocused-fg` is a new token that now correctly holds the ultra-muted values.
- Old `--nav-chrome-hover` / `--nav-chrome-active` (button pressed) are dropped — they were the same values as `--tab-hover` / a darker press state. Consumers can use `--tab-hover` for hover and an inline opacity for press.

---

### List item tokens (`--list-*`)

New tokens for interactive list/tree row states. Not applied to sidebar immediately — available for command palette, search results, tree views, and future sidebar migration.

| CSS Variable | Purpose | Light (oklch) | Light ref | Dark (oklch) | Dark ref |
|---|---|---|---|---|---|
| `--list-hover` | Row hover bg | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 5%)` | — |
| `--list-hover-fg` | Row hover fg | `oklch(0.244 0 0)` | `#202020` | `oklch(0.805 0 0)` | `#bfbfbf` |
| `--list-active` | Keyboard-focused row bg | `oklch(0 0 0 / 10%)` | — | `oklch(1 0 0 / 8%)` | — |
| `--list-active-fg` | Keyboard-focused row fg | `oklch(0.244 0 0)` | `#202020` | `oklch(0.943 0 0)` | `#ededed` |
| `--list-selection` | Selected row bg (panel focused) | `oklch(0.529 0.174 255 / 10%)` | `#0069CC1A` | `oklch(0.630 0.104 231 / 15%)` | `#3994BC26` |
| `--list-selection-fg` | Selected row fg (panel focused) | `oklch(0.244 0 0)` | `#202020` | `oklch(0.943 0 0)` | `#ededed` |
| `--list-inactive-selection` | Selected row bg (panel unfocused) | `oklch(0 0 0 / 6%)` | — | `oklch(1 0 0 / 5%)` | — |
| `--list-inactive-selection-fg` | Selected row fg (panel unfocused) | `oklch(0.489 0 0)` | `#606060` | `oklch(0.640 0 0)` | `#8C8C8C` |

---

## Files Changed

### `packages/ui/src/styles/globals.css`

1. **`@theme inline`** — remove `--color-nav-chrome-*` block, add `--color-tab-*` block and `--color-list-*` block.
2. **`:root`** — replace `--nav-chrome-*` declarations with `--tab-*`. Fix values per table above. Add `--list-*` tokens.
3. **`.dark`** — same: replace `--nav-chrome-*` with `--tab-*`, fix values, add `--list-*` tokens.

### `apps/web/src/components/workspace/app-nav.tsx`

- Replace every `nav-chrome-*` Tailwind class with the corresponding `tab-*` class.
- `text-nav-chrome-fg/60` → `text-tab-inactive-fg` (proper token, no opacity hack).
- `[&.active]:text-nav-chrome-tab-active-fg` → `[&.active]:text-tab-active-fg`.
- `bg-nav-chrome` → `bg-tab`.

---

## Out of Scope

- `--sidebar-*` tokens — unchanged
- `packages/ui/src/components/sidebar.tsx` — unchanged
- `packages/ui/src/components/tabs.tsx` — unchanged (uses core semantic tokens, not `--tab-*`)
- Applying `--list-*` tokens to any component (tokens defined, wiring is future work)
