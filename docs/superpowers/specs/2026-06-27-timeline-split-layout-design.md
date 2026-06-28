# Timeline Split Layout (Shared Shell) — Design Spec

- **Date:** 2026-06-27
- **App:** `apps/web` (`@orbit/web`)
- **Status:** Approved, pending implementation plan
- **Branch:** `feat/timeline-calendar-axis`

## 1. Context & goal

We are building two timeline apps on top of the existing calendar/timeline axis:

- **Gantt** — each row is a **task** (hierarchy of tasks/milestones); a row's timeline track holds **one** bar (that task's date range).
- **Scheduler** — each row is a **user**; a manager schedules tasks onto the user's lane, so a row's track holds **many** bars, auto-stacked into sub-lanes when they overlap (variable row height).

Both share the same need: a **table pane on the left | timeline pane on the right**, with rows that align one-for-one and scroll together. This spec covers **only that shared shell** (sub-project 1). Gantt (sub-project 2) and Scheduler (sub-project 3) are separate specs built on this shell.

**In scope:** a resizable `SplitLayout` with aligned, variable-height rows; a single shared vertical scroll; a sticky header band (table column-headers + date axis); the timeline grid/now-line/scrollbar reused as background and footer; a thin demo binding so the shell runs and is testable.

**Out of scope (deferred to Gantt/Scheduler specs):** task hierarchy & expand/collapse, real table columns, multi-bar lane packing, drag-to-reschedule/assign, persistence.

## 2. Architecture

A single **shared vertical scroll** container holds flex rows shaped `[ table cell | timeline track ]`. One container means table and timeline rows can never drift — alignment and scroll-sync are free. A custom draggable **divider** sets the table-pane width.

We deliberately do **not** use `react-resizable-panels` here: two separate scroll panels would require fragile `scrollTop` mirroring. The timeline is already virtual (it pans by recomputing `offsetMs`, not native horizontal scroll), so the only native scroll is vertical — perfect for one shared container.

Layout:

```
SplitLayout (h-full, flex col)
├─ Header band (sticky top, not vertically scrolled; height = AXIS_HEIGHT)
│   [ table column-headers  | divider | TimeUnitsBar (date axis) ]
├─ Body (flex-1, overflow-y-auto)  ← THE shared vertical scroll
│   ├─ timeline background layer (absolute, height = totalHeight, offset under table width)
│   │     TimelineGrid + NowLine
│   └─ rows (relative): for each row →
│         [ table cell (width = tableWidth) | track (flex-1, relative, height = row.height) ]
└─ Footer (sticky bottom): TimelineScrollbar under the timeline pane only
```

- **Horizontal pan** (`usePan` wheel/drag) is wired on the **timeline pane region only**.
- **`viewportWidth`** measured by the controller now reflects the **timeline pane** width (= container width − tableWidth − divider), not the whole container, so axis/grid/bars position within the right pane. The header axis, background grid, per-row tracks, and footer scrollbar all share this same width.

## 3. The row model (contract for both apps)

```ts
export type TimelineRow = { id: string; height: number };

export type SplitLayoutProps = {
  rows: TimelineRow[];
  /** Left pane: header cells (column titles) and one cell per row. */
  renderTableHeader: () => React.ReactNode;
  renderTableCell: (row: TimelineRow) => React.ReactNode;
  /** Right pane: content positioned within the row's timeline track. */
  renderTrack: (row: TimelineRow) => React.ReactNode;
  /** Initial / persisted table width in px (default 320). */
  initialTableWidth?: number;
};
```

- Per-row `height` is variable — Gantt passes a uniform value; Scheduler computes height from the number of stacked lanes.
- The shell owns vertical geometry (each row's `top`, the total body height) and the table width; consumers own only what renders inside each cell/track.

## 4. Components (new `apps/web/src/components/timeline/layout/`)

- `layout/types.ts` — `TimelineRow`, `SplitLayoutProps`.
- `layout/row-geometry.ts` — pure helpers:
  - `rowTops(rows: TimelineRow[]): number[]` — cumulative top offset per row (prefix sum of heights).
  - `totalHeight(rows: TimelineRow[]): number` — sum of heights.
  - `clampTableWidth(px: number, min: number, max: number): number`.
- `layout/use-resizable-divider.ts` — pointer-drag hook returning `{ tableWidth, onDividerPointerDown }`, clamping via `clampTableWidth`.
- `layout/split-layout.tsx` — the shell described in §2.
- **Reused as-is:** `TimeUnitsBar`, `TimelineGrid`, `NowLine`, `TimelineScrollbar`, `usePan`, the controller + hooks.
- **Change:** the width-measuring `ResizeObserver`/`useResizeObserver` is attached to the **timeline pane element** so `viewportWidth` = right-pane width. (Today it measures the whole canvas in `container/index.tsx`.)

Constants: `AXIS_HEIGHT = 48` (matches the current `h-12` header band), `DEFAULT_TABLE_WIDTH = 320`, `MIN_TABLE_WIDTH = 160`, `MAX_TABLE_WIDTH = 640`.

## 5. Demo binding (runnable + testable, not the Gantt app)

A thin consumer (`layout/demo/` or reuse in the route) maps `timeline-items` to uniform-height rows:
- `renderTableHeader` → a single "Name" column header.
- `renderTableCell(row)` → the item's name (+ color dot).
- `renderTrack(row)` → one bar positioned via `getPercentageOffset(from)`/`(to)` for that item's date range (same math as the existing `TaskBars`).

Mounted in `routes/_workspace/$orgSlug/timeline.tsx` in place of the current full-width `TimelineContainer`. This proves the shell; it intentionally omits hierarchy, extra columns, and interaction (those are the Gantt spec).

## 6. Testing (Vitest + Testing Library)

- `row-geometry.test.ts` — `rowTops` prefix sums (incl. variable heights), `totalHeight`, `clampTableWidth` bounds.
- `use-resizable-divider.test.ts` (or via the render test) — dragging changes width and clamps at min/max.
- `split-layout.test.tsx` — given N rows: renders N table cells + N tracks; the header band shows the table header + the date axis; the divider is present; dragging the divider changes the table width; total body height equals `totalHeight(rows)`.
- Scroll-sync is structural (single container) → no dedicated test.
- Reuse the established happy-dom `ResizeObserver` mock so the timeline pane reports a nonzero width.

## 7. Integration & follow-ons

- The standalone `TimelineContainer` may be retained for reference, but the route renders the new `SplitLayout` demo binding.
- **Sub-project 2 (Gantt):** flatten the task tree into rows with indentation + expand/collapse; real table columns (name/assignee/dates/status/progress); one bar per row; optional drag-to-reschedule.
- **Sub-project 3 (Scheduler):** user rows; pack each user's tasks into stacked lanes and set `row.height` from lane count; assign/drag tasks onto lanes.
