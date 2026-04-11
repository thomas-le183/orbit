# App Shell Navigation — Spec

**Date:** 2026-04-11
**Status:** Approved

## Context

Orbit supports four main modules: Chat, Tasks, Time Tracking, and AI Chat. Each module is a distinct route under `/$orgSlug/`. The current `AppNav` and `AppSidebar` components are placeholders — `AppNav` lists 4 items (Home, Wiki, AI, Chat) with no sub-navigation, and `AppSidebar` only shows a single "Home" link. 

The goal is a two-layer navigation shell:
1. **Icon rail** — switches between modules, always visible
2. **Contextual sidebar** — sub-navigation specific to the active module

## Layout

```
[ TopNav — h-44px, full width, unchanged                              ]
[ Rail 52px | Sidebar 220px (resizable) | Content (flex-1)           ]
```

The overall shell structure in `_workspace/$orgSlug.tsx` stays as-is (TopNav + ResizablePanelGroup). Only `AppNav` and `AppSidebar` change.

## Module Definitions

| Module | Icon | Route | Rail tooltip |
|---|---|---|---|
| Chat | MessageSquare | `/$orgSlug/chat` | Chat |
| Tasks | CheckSquare | `/$orgSlug/tasks` | Tasks |
| Time | Clock | `/$orgSlug/time` | Time |
| AI Chat | Bot | `/$orgSlug/ai` | AI Chat |

Settings lives at the bottom of the rail (gear icon), routes to `/$orgSlug/settings`.

## AppNav (Icon Rail)

**File:** `apps/web/src/components/workspace/app-nav.tsx`

- Width: 52px, `border-right: 1px solid #1a1a1a`, `bg-sidebar`
- Each module item: 36×36px, `rounded-lg`, centered icon (16px Lucide)
- **Inactive:** `text-muted-foreground`, transparent bg
- **Hover:** `bg-accent`
- **Active:** `bg-primary/10 text-primary` — the blue tint matching the mockup
- Active detection: use TanStack Router's `Link` with `activeOptions` (exact for index, non-exact for modules so sub-routes stay highlighted)
- Tooltip on hover: show module name via `title` attribute (native browser tooltip is fine for now)
- Settings icon pinned to bottom with `mt-auto` spacer

```tsx
const modules = [
  { to: '/$orgSlug/chat',     icon: MessageSquareIcon, label: 'Chat' },
  { to: '/$orgSlug/tasks',    icon: CheckSquareIcon,   label: 'Tasks' },
  { to: '/$orgSlug/time',     icon: ClockIcon,         label: 'Time' },
  { to: '/$orgSlug/ai',       icon: BotIcon,           label: 'AI Chat' },
] as const
```

## AppSidebar (Contextual Sub-nav)

**File:** `apps/web/src/components/workspace/app-sidebar.tsx`

The sidebar reads the current pathname to determine which module is active, then renders the appropriate sub-navigation. Use `useRouterState` from `@tanstack/react-router` to get the current location.

### Structure per module

**Chat** (`/$orgSlug/chat*`)
- Header: "Chat" title + MessageSquare icon + "+" new channel button
- Section "Channels": list of channel links (hardcoded placeholders for now, real data later)
  - `#general`, `#design-system`, `#backend`, `#announcements`
- Section "Direct Messages": list of DM links (hardcoded placeholders)
  - Example names only for now

**Tasks** (`/$orgSlug/tasks*`)
- Header: "Tasks" title + CheckSquare icon + "+" new task button
- Section "My Work": My tasks, Assigned to me
- Section "Projects": list of project links (placeholders)
- Section "Views": Board, Backlog

**Time** (`/$orgSlug/time*`)
- Header: "Time" title + Clock icon
- Section "Tracking": Today, This week, This month
- Section "Reports": By project, By member
- Section "Projects": same project list as Tasks (placeholder)

**AI Chat** (`/$orgSlug/ai*`)
- Header: "AI Chat" title + Bot icon + "+" new conversation button
- Section "Recent": last N conversations (hardcoded placeholders for now)
- Section "This week": older conversations

### Sidebar item anatomy
```
[ icon 13px ] [ label text-11px ] [ optional badge/dot ]
```
- Padding: `px-2 py-1.5`, `rounded-md`
- Inactive: `text-muted-foreground`
- Hover: `bg-accent text-accent-foreground`
- Active: `bg-primary/10 text-foreground`
- Unread badge: blue pill, `text-[9px]`, right-aligned
- Online dot: green circle 6px, right-aligned

### Section label
```
font-mono text-[9px] uppercase tracking-[1.2px] text-muted-foreground/60 px-2 mb-1
```

### Sidebar header
- Height: 44px, `border-bottom`, flex row
- Module icon (14px, `text-primary`) + module title (`text-sm font-semibold`) + optional "+" action button right-aligned

## New Routes (Placeholders)

Two routes don't exist yet and need stub files:

**`apps/web/src/routes/_workspace/$orgSlug/tasks.tsx`**
- Simple placeholder: heading "Tasks" + "Coming soon" note
- Full implementation is a future spec

**`apps/web/src/routes/_workspace/$orgSlug/time.tsx`**
- Simple placeholder: heading "Time Tracking" + "Coming soon" note
- Full implementation is a future spec

Existing routes `chat.tsx` and `ai.tsx` need no changes.

## What Changes

| File | Change |
|---|---|
| `apps/web/src/components/workspace/app-nav.tsx` | Full rewrite — 4 module items + settings at bottom |
| `apps/web/src/components/workspace/app-sidebar.tsx` | Full rewrite — route-aware contextual sub-nav |
| `apps/web/src/routes/_workspace/$orgSlug/tasks.tsx` | New — placeholder route |
| `apps/web/src/routes/_workspace/$orgSlug/time.tsx` | New — placeholder route |
| `apps/web/src/routes/_workspace/$orgSlug.tsx` | No change — shell structure stays as-is |
| `apps/web/src/routes/_workspace/$orgSlug/chat.tsx` | No change |
| `apps/web/src/routes/_workspace/$orgSlug/ai.tsx` | No change |

## What Gets Removed

- **Home** and **Wiki** items from `AppNav` — they had no sub-navigation and don't fit the module model. The `/$orgSlug/index.tsx` and `/$orgSlug/wiki.tsx` routes remain but are no longer reachable from the rail (they can be re-added later if needed).

## What Doesn't Change

- `TopNav` — unchanged, settings/search/user menu stay as-is
- `_workspace/$orgSlug.tsx` shell layout — ResizablePanelGroup stays
- All auth logic, org routing, `beforeLoad` hooks
- Existing route files for chat and ai

## Notes

- Sidebar data (channels, DMs, tasks, conversations) is hardcoded for now. Real data fetching per module is a separate spec for each module.
- The resizable panel behavior (collapsible sidebar) is already wired up in the shell — no changes needed.
- Route tree is auto-generated — adding `tasks.tsx` and `time.tsx` will update `routeTree.gen.ts` automatically on next dev server start.
