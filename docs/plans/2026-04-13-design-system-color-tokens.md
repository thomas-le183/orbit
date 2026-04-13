# Design System Color Tokens Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename `--nav-chrome-*` → `--tab-*` with correct per-state bg+fg tokens, and add `--list-*` interactive state tokens.

**Architecture:** Two-file change — `globals.css` gets the token renames/additions in `@theme inline`, `:root`, and `.dark`; `app-nav.tsx` gets its Tailwind class names updated to match. No component API changes, sidebar untouched.

**Tech Stack:** Tailwind CSS v4 (`@theme inline` custom properties), oklch color space, React

---

### Task 1: Replace nav-chrome block in `@theme inline`

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (lines 14–23, the `/* Nav chrome */` block inside `@theme inline`)

**Step 1: Replace the entire nav-chrome block with the tab block**

Old block (lines ~14–23):
```css
/* Nav chrome — tab bar */
--color-nav-chrome: var(--nav-chrome);
--color-nav-chrome-fg: var(--nav-chrome-fg);
--color-nav-chrome-hover: var(--nav-chrome-hover);
--color-nav-chrome-active: var(--nav-chrome-active);
/* tab active / inactive */
--color-nav-chrome-tab-active: var(--nav-chrome-tab-active);
--color-nav-chrome-tab-active-fg: var(--nav-chrome-tab-active-fg);
--color-nav-chrome-tab-active-border: var(--nav-chrome-tab-active-border);
--color-nav-chrome-tab-inactive-fg: var(--nav-chrome-tab-inactive-fg);
```

New block:
```css
/* Tab strip / activity rail */
--color-tab: var(--tab);
--color-tab-inactive: var(--tab-inactive);
--color-tab-inactive-fg: var(--tab-inactive-fg);
--color-tab-hover: var(--tab-hover);
--color-tab-hover-fg: var(--tab-hover-fg);
--color-tab-active: var(--tab-active);
--color-tab-active-fg: var(--tab-active-fg);
--color-tab-active-border: var(--tab-active-border);
--color-tab-unfocused-fg: var(--tab-unfocused-fg);
```

**Step 2: Add list block to `@theme inline` (after the tab block)**

```css
/* List items */
--color-list-hover: var(--list-hover);
--color-list-hover-fg: var(--list-hover-fg);
--color-list-active: var(--list-active);
--color-list-active-fg: var(--list-active-fg);
--color-list-selection: var(--list-selection);
--color-list-selection-fg: var(--list-selection-fg);
--color-list-inactive-selection: var(--list-inactive-selection);
--color-list-inactive-selection-fg: var(--list-inactive-selection-fg);
```

**Step 3: Verify no nav-chrome references remain in `@theme inline`**

Run: `grep -n "nav-chrome" packages/ui/src/styles/globals.css`
Expected: matches only in `:root` and `.dark` blocks, none inside `@theme inline`

---

### Task 2: Replace nav-chrome variables in `:root`, fix values, add list tokens

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (`:root` block, lines ~92–101)

**Step 1: Replace the nav-chrome variable block in `:root`**

Remove:
```css
/* Nav chrome ---------------------------------------------------------- */
--nav-chrome: oklch(0.986 0.004 286);
--nav-chrome-fg: oklch(0.489 0 0);
--nav-chrome-hover: oklch(0 0 0 / 6%);
--nav-chrome-active: oklch(0 0 0 / 18%);
/* tab active / inactive */
--nav-chrome-tab-active: oklch(1 0 0);
--nav-chrome-tab-active-fg: oklch(0.244 0 0);
--nav-chrome-tab-active-border: oklch(0 0 0);
--nav-chrome-tab-inactive-fg: oklch(0.792 0 0);
```

Add:
```css
/* Tab strip / activity rail ------------------------------------------ */
--tab: oklch(0.986 0.004 286);                   /* #FAFAFD  tab.inactiveBackground */
--tab-inactive: transparent;
--tab-inactive-fg: oklch(0.489 0 0);             /* #606060  tab.inactiveForeground */
--tab-hover: oklch(0 0 0 / 6%);
--tab-hover-fg: oklch(0.244 0 0);                /* #202020 */
--tab-active: oklch(1 0 0);                      /* #FFFFFF  tab.activeBackground */
--tab-active-fg: oklch(0.244 0 0);               /* #202020  tab.activeForeground */
--tab-active-border: oklch(0.529 0.174 255);     /* #0069CC  tab.activeBorderTop */
--tab-unfocused-fg: oklch(0.792 0 0);            /* #BBBBBB  tab.unfocusedInactiveForeground */
```

**Step 2: Add list tokens at end of `:root` (after the `--vscode-*` block, before closing `}`)**

```css
/* List items --------------------------------------------------------- */
--list-hover: oklch(0 0 0 / 6%);
--list-hover-fg: oklch(0.244 0 0);               /* #202020 */
--list-active: oklch(0 0 0 / 10%);
--list-active-fg: oklch(0.244 0 0);              /* #202020 */
--list-selection: oklch(0.529 0.174 255 / 10%);  /* #0069CC1A */
--list-selection-fg: oklch(0.244 0 0);           /* #202020 */
--list-inactive-selection: oklch(0 0 0 / 6%);
--list-inactive-selection-fg: oklch(0.489 0 0);  /* #606060 */
```

**Step 3: Confirm nav-chrome only remains in `.dark`**

Run: `grep -n "nav-chrome" packages/ui/src/styles/globals.css`
Expected: matches only inside `.dark { }` block

---

### Task 3: Replace nav-chrome variables in `.dark`, fix values, add list tokens

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (`.dark` block, lines ~164–173)

**Step 1: Replace the nav-chrome variable block in `.dark`**

Remove:
```css
/* Nav chrome ---------------------------------------------------------- */
--nav-chrome: oklch(0.217 0.003 248);
--nav-chrome-fg: oklch(0.640 0 0);
--nav-chrome-hover: oklch(1 0 0 / 9%);
--nav-chrome-active: oklch(1 0 0 / 22%);
/* tab active / inactive */
--nav-chrome-tab-active: oklch(0.186 0.003 248);
--nav-chrome-tab-active-fg: oklch(0.805 0 0);
--nav-chrome-tab-active-border: oklch(0.630 0.104 231);
--nav-chrome-tab-inactive-fg: oklch(0.337 0 0);
```

Add:
```css
/* Tab strip / activity rail ------------------------------------------ */
--tab: oklch(0.217 0.003 248);                   /* #191A1B  tab.inactiveBackground */
--tab-inactive: transparent;
--tab-inactive-fg: oklch(0.640 0 0);             /* #8C8C8C  tab.inactiveForeground */
--tab-hover: oklch(1 0 0 / 9%);
--tab-hover-fg: oklch(0.805 0 0);                /* #bfbfbf */
--tab-active: oklch(0.186 0.003 248);            /* #121314  tab.activeBackground */
--tab-active-fg: oklch(0.805 0 0);               /* #bfbfbf  tab.activeForeground */
--tab-active-border: oklch(0.630 0.104 231);     /* #3994BC  tab.activeBorderTop */
--tab-unfocused-fg: oklch(0.337 0 0);            /* #444444  tab.unfocusedInactiveForeground */
```

**Step 2: Add list tokens at end of `.dark` (after the `--vscode-*` block, before closing `}`)**

```css
/* List items --------------------------------------------------------- */
--list-hover: oklch(1 0 0 / 5%);
--list-hover-fg: oklch(0.805 0 0);               /* #bfbfbf */
--list-active: oklch(1 0 0 / 8%);
--list-active-fg: oklch(0.943 0 0);              /* #ededed */
--list-selection: oklch(0.630 0.104 231 / 15%);  /* #3994BC26 */
--list-selection-fg: oklch(0.943 0 0);           /* #ededed */
--list-inactive-selection: oklch(1 0 0 / 5%);
--list-inactive-selection-fg: oklch(0.640 0 0);  /* #8C8C8C */
```

**Step 3: Confirm zero nav-chrome references remain**

Run: `grep -n "nav-chrome" packages/ui/src/styles/globals.css`
Expected: no matches

**Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat(ui): rename nav-chrome→tab tokens, fix inactive fg + active border, add list-item tokens"
```

---

### Task 4: Update `app-nav.tsx` class names

**Files:**
- Modify: `apps/web/src/components/workspace/app-nav.tsx`

**Step 1: Update the container div**

`bg-nav-chrome` → `bg-tab`

**Step 2: Update inactive link state (both the module links and the settings link)**

`text-nav-chrome-fg/60` → `text-tab-inactive-fg`

(Remove the `/60` opacity hack — `--tab-inactive-fg` is already the correct readable value.)

**Step 3: Update active fg class**

`[&.active]:text-nav-chrome-tab-active-fg` → `[&.active]:text-tab-active-fg`

The `hover:text-nav-chrome-fg` reference (if present) → `hover:text-tab-hover-fg`

The active left-border pseudo-element uses `bg-primary` directly — leave unchanged.

**Step 4: Confirm no nav-chrome references remain**

Run: `grep -n "nav-chrome" apps/web/src/components/workspace/app-nav.tsx`
Expected: no matches

**Step 5: Lint**

Run: `npm run check` from repo root
Expected: no errors

**Step 6: Commit**

```bash
git add apps/web/src/components/workspace/app-nav.tsx
git commit -m "feat(web): update app-nav to tab tokens, drop opacity hack on inactive fg"
```

---

### Task 5: Final verification

**Step 1: Confirm sidebar is untouched**

Run: `grep -n "nav-chrome\|--tab\|--list" apps/web/src/components/workspace/app-sidebar.tsx`
Expected: no matches

**Step 2: Type-check**

Run: `npm run check-types` from repo root
Expected: no errors
