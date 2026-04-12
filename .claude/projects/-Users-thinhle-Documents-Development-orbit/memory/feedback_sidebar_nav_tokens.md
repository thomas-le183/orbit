---
name: Sidebar and nav use separate color tokens
description: Sidebar must never use nav-chrome-* CSS variables — they have their own sidebar-* token set that will diverge in future presets
type: feedback
---

Never use `nav-chrome-*` color tokens (`text-nav-chrome-fg`, `hover:bg-nav-chrome-hover`, etc.) inside sidebar components. The sidebar has its own parallel token set in `globals.css`:

- `--sidebar` / `bg-sidebar` — background
- `--sidebar-foreground` / `text-sidebar-foreground` — text color
- `--sidebar-accent` / `bg-sidebar-accent` — hover background
- `--sidebar-accent-foreground` / `text-sidebar-accent-foreground` — hover text
- `--sidebar-active` / `bg-sidebar-active` — active/selected background

**Why:** Nav and sidebar currently share the same background color, but will diverge in future theme presets. Using separate tokens keeps them independently themeable without touching component code.

**How to apply:** Any time you style sidebar items, headers, or section labels, reach for `sidebar-*` tokens only. If a new sidebar interaction state is needed, add a new `--sidebar-*` variable to `globals.css` under both `:root` and `.dark`, and register it in `@theme inline`.
