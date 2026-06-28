# Timeline Row Selection & Hover — Design Spec

- **Date:** 2026-06-27
- **App:** `apps/web` (`@orbit/web`)
- **Status:** Approved, pending implementation plan
- **Branch:** `main`

## 1. Context & goal

The timeline split layout renders rows in two independent places — the left table
(`timeline-table`, `data-testid="timeline-table-row"`) and the timeline bars
(`items-layer`) — both keyed by `item.id`, with **no shared selection/hover state**.

This feature adds **bulk row selection** and **row hover**, highlighted in lockstep
across both panes. It is the first slice of the shared cross-pane state that the
Gantt/Scheduler sub-projects will build on, so the store is a small reusable provider.

**In scope:** a shared selection/hover store; click-to-select, shift-click range,
select-all checkbox (+ per-row checkboxes), Esc to clear; hover highlight; selected/
hovered highlight across the table cell and a timeline row-band behind the bars;
selecting by clicking a bar.

**Out of scope (YAGNI / later):** Cmd/Ctrl-click individual toggle (per-row checkboxes
cover toggling instead); bulk actions on the selection (move/delete/assign) — this
feature only establishes selection state + visuals; persistence.

## 2. Architecture — a dedicated shared store

A `RowSelectionProvider` (new folder `apps/web/src/components/timeline/selection/`)
wraps the split layout and holds:

- `selectedIds: Set<string>`
- `hoveredId: string | null`
- `anchorId: string | null` — the last single-selected row, the anchor for shift-range.

Exposed via `useRowSelection()`. Both `timeline-table` and `items-layer` consume this one
hook, so a row's selected/hovered state is identical in both panes by construction.
(Extending `TimelineProvider` was considered and rejected — keep time-axis state separate.)

Range math is a pure helper in `selection/range.ts` so it is unit-testable in isolation.

The provider is data-decoupled: actions that need row order receive `orderedIds` from the
caller. Both panes derive the same order from `layoutItems(items, today).rows`, so neither
the provider nor the helper imports timeline data.

## 3. The store API

```ts
type RowSelection = {
  selectedIds: ReadonlySet<string>;
  hoveredId: string | null;
  isSelected: (id: string) => boolean;
  /** Select only this row; sets it as the range anchor. */
  selectOne: (id: string) => void;
  /** Select the inclusive range from the anchor (or this row if no anchor) to `id`. */
  selectTo: (id: string, orderedIds: string[]) => void;
  /** Add/remove a single row (per-row checkbox); sets anchor to `id`. */
  toggle: (id: string) => void;
  /** Select every id (header checkbox "all"); clear when already all selected. */
  selectAll: (orderedIds: string[]) => void;
  clear: () => void;
  setHovered: (id: string | null) => void;
};

// selection/range.ts
/** Inclusive id range between anchor and target within orderedIds.
 *  If anchor is null or not found, returns [target]. Order-independent (anchor may be
 *  before or after target). */
export function rangeIds(
  orderedIds: string[],
  anchorId: string | null,
  targetId: string,
): string[];
```

A single mouse-down helper in each pane maps the event to an action:
`shiftKey && anchorId` → `selectTo`; otherwise → `selectOne`.

## 4. Components

New (`apps/web/src/components/timeline/selection/`):
- `range.ts` — `rangeIds(orderedIds, anchorId, targetId)`.
- `context.tsx` — `RowSelectionProvider`, `useRowSelection()`.

Modified:
- `layout/split-layout.tsx` — wrap `SplitLayoutInner` in `RowSelectionProvider` (inside
  `TimelineProvider`), and add a global Esc-to-clear key handler.
- `layout/timeline-table.tsx`:
  - Header (`TimelineTableHeader`): a select-all checkbox (checked when all visible rows
    are selected; click toggles all/none). It derives `orderedIds` from
    `layoutItems(items, today).rows`, same as the body.
  - Body rows: a leading per-row checkbox (`toggle(id)`); row click → `selectOne`,
    shift-click → `selectTo(id, orderedIds)`; `onMouseEnter`/`onMouseLeave` → `setHovered`.
  - Row classes: selected → `bg-accent`; hovered (not selected) → `bg-muted/50`.
- `items-layer.tsx`:
  - A **row-band layer** rendered before the bars: for each row that is selected or
    hovered, a full-width band at `top = rowIndex × ROW_HEIGHT`, `height = ROW_HEIGHT`,
    `inset-x-0`, behind the bars (`pointer-events-none`). Selected → `bg-accent`; hovered →
    `bg-muted/50`. (Selected takes precedence when both.)
  - Bars/milestones: `onClick` (or the existing pointer-down path) → `selectOne` /
    `selectTo`; `onMouseEnter`/`onMouseLeave` → `setHovered(item.id)`. Selection clicks must
    not interfere with the existing drag/resize gestures (treat a click without drag as a
    selection; a drag is a move/resize as today).

Constants: reuse `ROW_HEIGHT` from `layout/row-metrics`.

## 5. Interaction details

- **Plain click** (row body or bar): `selectOne(id)` — replaces the selection, sets anchor.
- **Shift-click**: `selectTo(id, orderedIds)` — inclusive range from anchor to id; if no
  anchor, behaves like `selectOne`.
- **Per-row checkbox**: `toggle(id)` — adds/removes that row; sets anchor to id.
- **Header checkbox**: `selectAll(orderedIds)` when not all selected; `clear()` when all are.
- **Esc**: `clear()` (global key handler in the split layout, ignored while typing in a field
  — reuse the existing `isTypingTarget` guard pattern).
- **Hover**: `onMouseEnter` sets `hoveredId`, `onMouseLeave` clears it; both the table row and
  the timeline row-band for that id reflect it.

## 6. Testing (Vitest + Testing Library)

- `selection/range.test.ts` — forward range, backward range (anchor after target), null
  anchor → `[target]`, anchor/target equal → single, ids not in list handled.
- `selection/context.test.tsx` (via a tiny harness) — `selectOne` replaces and sets anchor;
  `selectTo` produces the range; `toggle` adds/removes; `selectAll` then `selectAll` clears;
  `clear`; `setHovered`.
- `timeline-table.test.tsx` — header checkbox selects all visible rows; a row click marks it
  selected (asserts the selected class / `aria-selected`); shift-click selects a range;
  hovering applies the hover class.
- `items-layer.test.tsx` — a row band renders (`data-testid="timeline-row-band"`) for a
  selected id and for a hovered id.

Selection visuals are asserted via class names / `data-` attributes, not pixel state.

## 7. Integration & follow-ons

- `RowSelectionProvider` is reused by the Gantt and Scheduler sub-projects.
- Natural follow-ons (separate specs): Cmd/Ctrl-click toggle; a selection action bar (bulk
  move/assign/delete) driven by `selectedIds`; keyboard up/down to move the selection.
