# Landing Page Redesign — Spec

**Date:** 2026-04-11
**Status:** Approved

## Context

The current landing page (`apps/web/src/routes/index.tsx`) uses a "cosmos" theme — 200 animated twinkling stars, drifting nebula blobs, a shimmering rainbow-gradient headline, a floating planet with spinning rings, and glowing feature cards in violet/cyan/amber. It is too colorful and visually busy. The user wants a modern, tech, science aesthetic.

## Design Decisions

| Question | Decision |
|---|---|
| Color palette | Dark graphite (`#0d0d0d` base) + single blue accent (`#3b82f6`) |
| Hero visual | Terminal / CLI block with realistic Orbit command output |
| Page structure | Hero + Features Strip (Approach 2) |
| Mood reference | Linear, GitHub, Resend — restrained, engineering-forward |

## Color Tokens

No new CSS variables needed — the existing `globals.css` dark mode tokens stay as-is for the app. The landing page uses inline Tailwind classes with these values:

| Role | Value |
|---|---|
| Page background | `#0d0d0d` |
| Surface (cards, terminal) | `#0a0a0a` / `#080808` |
| Border | `#1a1a1a` / `#1f1f1f` |
| Primary accent | `#3b82f6` (blue) |
| Accent tint bg | `#0f1d35` |
| Accent tint border | `#1e3a5f` |
| Text primary | `#f0f0f0` |
| Text secondary | `#555` |
| Text dimmed | `#333` / `#2d2d2d` |

## Sections

### 1. Nav

- Logo: blue `#3b82f6` square (24×24) with an inline SVG orbit ring mark + "Orbit" wordmark
- Right side: ghost "Log in" button + solid blue "Get started" button
- Background: `#0d0d0d`, bottom border `#1a1a1a`
- No additional nav links — keep it minimal

### 2. Hero

Two-column grid (50/50), centered, `max-w-6xl`.

**Left column:**
- Badge pill: monospace font, blue text, blue dot with pulse animation, border `#1e3a5f`, bg `#0f1d35`, text `v0.1 · early access`
- Headline: `text-4xl`–`text-5xl`, `font-extrabold`, `tracking-tight`, `#f0f0f0`. One word wrapped in `<em>` styled `#3b82f6` (the word "teams")
- Subtext: `text-sm`, `#555`, max-w ~320px
- CTAs: "Start for free →" (solid blue) + "Sign in" (ghost with border `#1f1f1f`)
- Note: `// free for small teams · no credit card` in monospace, `#333`

**Right column — Terminal block:**
- Window chrome: macOS-style traffic light dots (red/yellow/green), title `orbit — workspace shell`, border-bottom `#1a1a1a`
- Body: monospace font, `font-size: 11px`, `line-height: 2`
- Lines shown:
  ```
  $ orbit auth login
  ✓ Authenticated as you@company.com

  $ orbit workspace connect acme-corp
  ✓ Workspace acme-corp synced in 48ms
  ✓ 14 channels · 6 members online

  $ orbit status
  ● design-system — 3 unread
  ● backend — aria typing...
  ○ announcements

  $ █  ← blinking cursor
  ```
- Color coding: `$` prompt `#2d2d2d`, commands `#555`, `✓` and `●` blue, values white, dim text `#333`, green `●` for active channels via `#22c55e`
- Box shadow: subtle blue glow `rgba(59,130,246,0.04)`

**Hero background:** Blueprint grid overlay — `linear-gradient` hairlines at 28px spacing, `rgba(59,130,246,0.04)` — subtle, not distracting.

### 3. Stats Bar

Single row, `border-top` + `border-bottom` `#161616`, centered. Four stats separated by 1px vertical hairlines:

| Value | Label |
|---|---|
| 5,000+ | teams active |
| 99.9% | uptime |
| < 50ms | avg latency |
| E2E | encrypted |

Labels in monospace, `10px`, `letter-spacing: 1.5px`, uppercase, `#333`.

### 4. Features Section

- Section label: `// core modules` — monospace, `#3b82f6`, with `//` prefix in `#2d2d2d`
- Section heading: `"Everything your team needs. Nothing it doesn't."`, `text-2xl`, `font-bold`
- 3-column card grid, gap `16px`

Each card:
- `background: #0a0a0a`, `border: 1px solid #1a1a1a`, `border-radius: 8px`
- Top edge: 1px gradient line `linear-gradient(90deg, transparent, #3b82f620, transparent)` via `::after`
- Hover: border transitions to `#1e3a5f`
- Icon box: 30×30, bg `#0f1d35`, border `#1e3a5f`, radius 6px, SVG icon in blue
- Title: `12px`, `font-semibold`, `#d0d0d0`
- Description: `11px`, `#3a3a3a`, `line-height: 1.6`

Cards:
1. **Channels & threads** — message bubble SVG — "Organized messaging around projects, not buried in a sidebar. Threads keep context intact."
2. **Tasks & projects** — checkbox SVG — "Boards, priorities, and deadlines. See what's shipping and who's on it — in one view."
3. **Presence & status** — users SVG — "Real-time indicators, typing signals, and activity status. Always know who's available."

### 5. CTA Section

Horizontal layout (`justify-between`), `border-top: 1px solid #161616`.

- Left: `h2` "Ready to reach orbit?" + `p` "Join 5,000+ teams already shipping faster."
- Right: "Get started free →" blue button + `// no credit card required` monospace note below it

### 6. Footer

Single row, `border-top: 1px solid #141414`.

- Left: logo mark + "Orbit" wordmark in `#333`
- Center: 4 links (Features, Pricing, Docs, Changelog) in `#2a2a2a`
- Right: `© 2026 Orbit` in monospace, `#222`

## What Gets Removed

- All `Stars` and `MiniStars` components (random star generation)
- All nebula blob `<div>`s with `anim-blob` animations
- The floating planet with orbital rings
- The `text-cosmos` shimmer gradient animation
- The `card-cosmos` gradient border cards
- The `@import` for Syne font from Google Fonts
- All `@keyframes` for `blobDrift`, `ringRotate`, `shimmer`, `pulseRing`, `float`, `twinkle`
- The `font-display` class (Syne) — Inter is already loaded via `globals.css`
- Inline `<style>` block entirely replaced with a minimal one covering only terminal cursor blink and badge dot pulse

## What Stays

- All routing logic (`beforeLoad`, `loadAuthState`, `resolveAuthenticatedLanding`) — untouched
- `Button` component from `@orbit/ui`
- `Link` from `@tanstack/react-router`
- Lucide icons (swapped to simpler inline SVGs for feature cards)
- The three feature copy points (channels, tasks, presence)
- The stats (5,000+ teams, 99.9% uptime, <50ms latency)

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/routes/index.tsx` | Full rewrite of `LandingPage` function and supporting components |
| `packages/ui/src/styles/globals.css` | Remove the "deep space navy-black" dark mode overrides — reset to a neutral dark palette consistent with the graphite approach |

> **Note on globals.css:** The current dark mode CSS uses violet/cyan (`oklch(0.62 0.27 292)` primary). This should be updated so the app's primary color aligns with blue (`#3b82f6` ≈ `oklch(0.62 0.21 255)`) for consistency across the whole product, not just the landing page.
