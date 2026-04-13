# Design System Color Tokens Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename `--nav-chrome-*` tokens to `--nav-tab-*` with corrected color values, and add new `--list-*` interactive state tokens.

**Architecture:** Two-file change — `globals.css` gets the token renames/additions in `@theme inline`, `:root`, and `.dark`; `app-nav.tsx` gets its Tailwind class names updated to match. No component API changes, no sidebar touched.

**Tech Stack:** Tailwind CSS v4 (custom properties via `@theme inline`), oklch color space, React + TanStack Router

---

### Task 1: Rename nav-chrome → nav-tab in `@theme inline`

**Files:**
- Modify: `packages/ui/src/styles/globals.css:14-23`

**Step 1: Replace the nav-chrome block in `@theme inline`**

Replace lines 14–23 (the `/* Nav chrome */` block) with:

```css
/* Nav tab — tab bar / activity rail */
--color-nav-tab: var(--nav-tab);
--color-nav-tab-fg: var(--nav-tab-fg);
--color-nav-tab-hover: var(--nav-tab-hover);
--color-nav-tab-btn-hover: var(--nav-tab-btn-hover);
--color-nav-tab-btn-active: var(--nav-tab-btn-active);
/* tab active state */
--color-nav-tab-active: var(--nav-tab-active);
--color-nav-tab-active-fg: var(--nav-tab-active-fg);
--color-nav-tab-active-border: var(--nav-tab-active-border);
/* tab inactive / unfocused */
--color-nav-tab-unfocused-fg: var(--nav-tab-unfocused-fg);
```

**Step 2: Verify no `nav-chrome` references remain in `@theme inline`**

Run: `grep -n "nav-chrome" packages/ui/src/styles/globals.css`
Expected: matches only in `:root` and `.dark` (not in `@theme inline`)

---

### Task 2: Rename nav-chrome → nav-tab in `:root`, fix values, add list tokens

**Files:**
- Modify: `packages/ui/src/styles/globals.css:92-152`

**Step 1: Replace the nav-chrome block in `:root`**

Replace the `/* Nav chrome */` comment block (lines ~92-101) with:

```css
/* Nav tab ------------------------------------------------------------ */
--nav-tab: oklch(0.986 0.004 286);              /* #FAFAFD  tab.inactiveBackground */
--nav-tab-fg: oklch(0.489 0 0);                 /* #606060  tab.inactiveForeground (readable) */
--nav-tab-hover: oklch(0 0 0 / 6%);             /* subtle tab hover bg */
--nav-tab-btn-hover: oklch(0 0 0 / 6%);         /* icon button hover in bar */
--nav-tab-btn-active: oklch(0 0 0 / 18%);       /* icon button pressed */
--nav-tab-active: oklch(1 0 0);                 /* #FFFFFF  tab.activeBackground */
--nav-tab-active-fg: oklch(0.244 0 0);          /* #202020  tab.activeForeground */
--nav-tab-active-border: oklch(0.529 0.174 255); /* #0069CC  tab.activeBorderTop (blue) */
--nav-tab-unfocused-fg: oklch(0.792 0 0);       /* #BBBBBB  tab.unfocusedInactiveForeground */
```

**Step 2: Add `--list-*` tokens at end of `:root` (before closing `}`, after the vscode-extras block)**

```css
/* List items --------------------------------------------------------- */
--list-hover: oklch(0 0 0 / 6%);                /* list.hoverBackground */
--list-active: oklch(0 0 0 / 10%);              /* list.focusBackground */
--list-active-fg: oklch(0.244 0 0);             /* list.focusForeground */
--list-selection: oklch(0.529 0.174 255 / 10%); /* list.activeSelectionBackground */
--list-selection-fg: oklch(0.244 0 0);          /* list.activeSelectionForeground */
--list-inactive-selection: oklch(0 0 0 / 6%);   /* list.inactiveSelectionBackground */
--list-inactive-selection-fg: oklch(0.489 0 0); /* list.inactiveSelectionForeground */
```

**Step 3: Verify `:root` has no remaining `nav-chrome` references**

Run: `grep -n "nav-chrome" packages/ui/src/styles/globals.css`
Expected: matches only in `.dark` block

---

### Task 3: Rename nav-chrome → nav-tab in `.dark`, fix values, add list tokens

**Files:**
- Modify: `packages/ui/src/styles/globals.css:154-223`

**Step 1: Replace the nav-chrome block in `.dark`**

Replace the `/* Nav chrome */` comment block with:

```css
/* Nav tab ------------------------------------------------------------ */
--nav-tab: oklch(0.217 0.003 248);               /* #191A1B  tab.inactiveBackground */
--nav-tab-fg: oklch(0.640 0 0);                  /* #8C8C8C  tab.inactiveForeground (readable) */
--nav-tab-hover: oklch(1 0 0 / 9%);              /* subtle tab hover bg */
--nav-tab-btn-hover: oklch(1 0 0 / 9%);          /* icon button hover in bar */
--nav-tab-btn-active: oklch(1 0 0 / 22%);        /* icon button pressed */
--nav-tab-active: oklch(0.186 0.003 248);        /* #121314  tab.activeBackground */
--nav-tab-active-fg: oklch(0.805 0 0);           /* #bfbfbf  tab.activeForeground */
--nav-tab-active-border: oklch(0.630 0.104 231); /* #3994BC  tab.activeBorderTop */
--nav-tab-unfocused-fg: oklch(0.337 0 0);        /* #444444  tab.unfocusedInactiveForeground */
```

**Step 2: Add `--list-*` tokens at end of `.dark` (before closing `}`)**

```css
/* List items --------------------------------------------------------- */
--list-hover: oklch(1 0 0 / 5%);                 /* list.hoverBackground */
--list-active: oklch(1 0 0 / 8%);                /* list.focusBackground */
--list-active-fg: oklch(0.943 0 0);              /* #ededed  list.focusForeground */
--list-selection: oklch(0.630 0.104 231 / 15%);  /* list.activeSelectionBackground */
--list-selection-fg: oklch(0.943 0 0);           /* #ededed  list.activeSelectionForeground */
--list-inactive-selection: oklch(1 0 0 / 5%);    /* list.inactiveSelectionBackground */
--list-inactive-selection-fg: oklch(0.640 0 0);  /* #8C8C8C  list.inactiveSelectionForeground */
```

**Step 3: Verify no nav-chrome references remain anywhere**

Run: `grep -n "nav-chrome" packages/ui/src/styles/globals.css`
Expected: no matches

**Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat(ui): rename nav-chrome→nav-tab tokens, fix inactive fg + active border colors, add list-item tokens"
```

---

### Task 4: Add `--color-list-*` entries to `@theme inline`

**Files:**
- Modify: `packages/ui/src/styles/globals.css` — inside `@theme inline` block

**Step 1: Add list token references after the nav-tab block in `@theme inline`**

```css
/* List items */
--color-list-hover: var(--list-hover);
--color-list-active: var(--list-active);
--color-list-active-fg: var(--list-active-fg);
--color-list-selection: var(--list-selection);
--color-list-selection-fg: var(--list-selection-fg);
--color-list-inactive-selection: var(--list-inactive-selection);
--color-list-inactive-selection-fg: var(--list-inactive-selection-fg);
```

**Step 2: Verify all list vars resolve**

Run: `npm run check-types` from repo root
Expected: no errors

---

### Task 5: Update `app-nav.tsx` class names

**Files:**
- Modify: `apps/web/src/components/workspace/app-nav.tsx`

**Step 1: Update the container div class**

Current: `bg-nav-chrome`
New: `bg-nav-tab`

**Step 2: Update the inactive link class**

Current: `text-nav-chrome-fg/60` (opacity hack)
New: `text-nav-tab-fg`

**Step 3: Update the active indicator and active fg classes**

Current: `[&.active]:text-nav-chrome-tab-active-fg`
New: `[&.active]:text-nav-tab-active-fg`

The active left-border pseudo-element uses `bg-primary` directly — that stays unchanged.

**Step 4: Update the settings link at the bottom (same class pattern)**

Apply the same substitutions to the settings `Link` className — it has the same `nav-chrome-*` references.

**Step 5: Verify no nav-chrome references remain in the file**

Run: `grep -n "nav-chrome" apps/web/src/components/workspace/app-nav.tsx`
Expected: no matches

**Step 6: Run lint**

Run: `npm run check` from repo root
Expected: no errors

**Step 7: Commit**

```bash
git add apps/web/src/components/workspace/app-nav.tsx
git commit -m "feat(web): update app-nav to use nav-tab tokens, remove opacity hack on inactive fg"
```

---

### Task 6: Verify `app-sidebar.tsx` is untouched

**Files:**
- Read only: `apps/web/src/components/workspace/app-sidebar.tsx`

**Step 1: Confirm no nav-chrome or nav-tab classes were accidentally added**

Run: `grep -n "nav-chrome\|nav-tab" apps/web/src/components/workspace/app-sidebar.tsx`
Expected: no matches

**Step 2: Final type-check**

Run: `npm run check-types` from repo root
Expected: no errors
