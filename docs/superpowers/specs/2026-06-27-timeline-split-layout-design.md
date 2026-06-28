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

## 2. Architecture (wrap the existing timeline body)

The timeline body already exists as a monolithic `ItemsLayer` driven by `layoutItems()` — it renders all rows (bars, parent-container rects, milestones, drag/resize gestures, out-of-view fly-outs) in one absolute layer, stacked at `rowIndex × ROW_HEIGHT`. We **reuse it as-is** rather than re-architect it into per-row tracks.

`SplitLayout` adds a **left table column** that aligns to those *same* rows (same `layoutItems` row order, same `ROW_HEIGHT`), and places the table column and `ItemsLayer` inside **one shared vertical scroll** so they can never drift. Alignment is guaranteed because both sides read the same rows and the same row-height metric. A custom draggable **divider** sets the table width.

We deliberately do **not** use `react-resizable-panels`: two separate scroll panels would require fragile `scrollTop` mirroring. The timeline pans by recomputing `offsetMs` (not native horizontal scroll), so the only native scroll is vertical — perfect for one shared container.

Layout:

```
SplitLayout (TimelineProvider) → flex col, h-full
├─ Header band (h-12, pinned, not scrolled)
│   [ table column-headers (w = tableWidth) │ divider │ TimeUnitsBar (flex-1) ]
├─ Body (flex-1, relative, overflow hidden)
│   ├─ pinned background over the right region (absolute, left = tableWidth, right = 0):
│   │     TimelineGrid + NowLine                       (not vertically scrolled)
│   └─ shared scroll (absolute inset-0, overflow-y-auto):
│         flex row, height = contentHeight:
│           [ table body (w = tableWidth): one cell per row ]
│           [ right region (flex-1, relative): ItemsLayer ]   ← bars; % within this region
├─ full-height draggable divider (absolute, at x = tableWidth)
└─ Footer (h-…, pinned): [ spacer (w = tableWidth) │ TimelineScrollbar (flex-1) ]
```

- **Horizontal pan** (`usePan` wheel + arrow keys) stays scoped to the timeline (right) region.
- **`viewportWidth`** is measured from the **right region element** (= container − tableWidth − divider), so axis/grid/bars/scrollbar all position within the timeline pane. Changing the table width re-measures it and reflows the timeline.
- The table column and `ItemsLayer` both size their content to `contentHeight = rows.length × ROW_HEIGHT + ROW_PADDING`, so their rows line up and scroll together.

## 3. The shell contract

`SplitLayout` is a fixed composition for sub-project 1 (not yet a fully generic primitive). The timeline (right) body is the existing `ItemsLayer`, hardcoded. The table (left) is passed in as node slots so the table component owns its own row rendering:

```ts
export type SplitLayoutProps = {
  /** Titles row shown in the header band, left of the date axis. */
  tableHeader: React.ReactNode;
  /** Left column body; sizes itself to contentHeight(rowCount) and renders one cell per row. */
  table: React.ReactNode;
  /** Initial table width in px (default DEFAULT_TABLE_WIDTH). */
  initialTableWidth?: number;
};
```

Alignment contract: both the `table` node and `ItemsLayer` lay rows out at `rowIndex × ROW_HEIGHT + ROW_PADDING` and size their content to `contentHeight(rowCount)`, importing those metrics from the shared `row-metrics` module — so rows line up without the shell threading per-row data. `RenderRow` (from `controller/layout.ts`: `{ item, depth, range, rowIndex, isParent }`) carries `depth` for table indentation. Variable per-row height (Scheduler) is a follow-on once `layoutItems` returns per-row heights.

Note: the table renders item data for display; live two-way sync with bar drag/resize (shared mutable item state) is a Gantt-spec concern, not part of the shell.

## 4. Components (new `apps/web/src/components/timeline/layout/`)

- `layout/row-metrics.ts` — extract the existing `ROW_HEIGHT = 40` and `ROW_PADDING = 7` from `items-layer.tsx` into a shared module; `items-layer.tsx` imports them so the table and the bars use the **same** metric. Also `contentHeight(rowCount)`.
- `layout/divider.ts` (pure) — `clampTableWidth(px, min, max)`.
- `layout/use-resizable-divider.ts` — pointer-drag hook returning `{ tableWidth, onDividerPointerDown }`, clamping via `clampTableWidth`.
- `layout/split-layout.tsx` — the shell in §2: header band, pinned background, shared-scroll body (table column + `ItemsLayer`), divider, footer scrollbar; wraps everything in `TimelineProvider` and measures the right region for `viewportWidth`.
- `layout/timeline-table.tsx` — the demo table (see §5).
- **Reused as-is:** `TimeUnitsBar`, `TimelineGrid`, `NowLine`, `TimelineScrollbar`, `ItemsLayer`, `usePan`, controller + hooks, `useTimelineItems`, `layoutItems`.

Constants: `DEFAULT_TABLE_WIDTH = 320`, `MIN_TABLE_WIDTH = 160`, `MAX_TABLE_WIDTH = 640`.

## 5. Demo table (runnable + testable, not the Gantt app)

`timeline-table.tsx` reads `useTimelineItems()` + `layoutItems(items, today).rows` and renders, per row at `top = rowIndex × ROW_HEIGHT + ROW_PADDING`:
- name, indented by depth (walk `parentId`), with a color dot;
- assignee name, start–end dates (from the item) — enough columns to prove alignment.

`renderTableHeader` is a simple titles row. Mounted via `SplitLayout` in `routes/_workspace/$orgSlug/timeline.tsx` in place of the current full-width `TimelineContainer` (which is retained for reference). This proves the shell; full hierarchy expand/collapse, rich columns, and inline editing are the **Gantt spec**.

## 6. Testing (Vitest + Testing Library)

- `divider.test.ts` — `clampTableWidth` clamps at min/max and passes through in-range values; `row-metrics` `contentHeight(n)` = `n × ROW_HEIGHT + ROW_PADDING`.
- `use-resizable-divider.test.ts` (or via the render test) — dragging changes width and clamps at min/max.
- `split-layout.test.tsx` — renders the header band (table header titles + the date axis), one table cell per `layoutItems` row, the `ItemsLayer` region, and the divider; dragging the divider changes the table width; the table column and `ItemsLayer` both report `contentHeight` so rows align.
- Scroll-sync is structural (single shared container) → no dedicated test.
- Reuse the established happy-dom `ResizeObserver` mock so the right region reports a nonzero width.

## 7. Integration & follow-ons

- The standalone `TimelineContainer` may be retained for reference, but the route renders the new `SplitLayout` demo binding.
- **Sub-project 2 (Gantt):** flatten the task tree into rows with indentation + expand/collapse; real table columns (name/assignee/dates/status/progress); one bar per row; optional drag-to-reschedule.
- **Sub-project 3 (Scheduler):** user rows; pack each user's tasks into stacked lanes and set `row.height` from lane count; assign/drag tasks onto lanes.
