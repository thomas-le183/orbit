# Gantt draft row for task creation

## Summary

Add an inline "draft row" to the **Gantt view** (not the scheduler) that lets a
user create a task without opening the modal. The row supports two gestures that
feed one pending draft:

- **Name-first quick-add** — type a name, press Enter → creates an *undated*
  task (it joins the existing "Unplanned" rows).
- **Drag-to-sketch** — drag across the row's canvas to set start/end dates, then
  name it and press Enter → creates a *dated* task that renders as a bar.

Both gestures write to a single pending-draft state, so the commit path is one
code path: name only → undated; name + dragged dates → dated.

The existing toolbar "New task" modal (`CreateTaskDialog`) stays as-is — it
remains the fallback when the table is collapsed. Removing it is a non-goal.

## Placement

The draft row is the **last content row** of the Gantt panes — appended after the
dated rows and the undated ("Unplanned") rows.

Rationale for last-content-row over a sticky footer band:

- The timeline grid, now-line, and milestone markers are pinned to the **body
  region only** (`split-layout.tsx`, the absolutely-positioned background at
  `left: tableWidth`). A sticky footer sits below that region and would have **no
  grid lines behind it** — precisely the surface where the user drags to sketch
  dates and needs to eyeball day boundaries. Last-content-row inherits the grid,
  now-line, and vertical alignment with real bars for free.
- It reuses the existing row geometry (`ROW_HEIGHT`, `rowTop`, `contentHeight`)
  and the shared virtualizer. Both panes already size to
  `contentHeight(rows.length + undatedTaskRows.length)`; we bump that count by one
  and position the draft row at `rowTop(rows.length + undatedTaskRows.length)`.
- It matches how undated rows are already appended as trailing content rows, and
  how Notion/Linear/Asana render their "+ New" affordance.

Trade-off accepted: the row is only visible when scrolled to the bottom. If an
always-visible entry point is wanted later, the cheap follow-up is a toolbar
button that scrolls to the bottom and focuses the draft input — not a duplicated
sticky band.

### Gating

The draft row renders only when:

- `projectId` is set (demo/static data has no create path), and
- the table is **not collapsed** (`tableWidth > 0`) — with no Name column there is
  nowhere to type. When collapsed, the toolbar "New task" modal is the fallback.

## Components and state

New files under `apps/web/src/components/timeline/draft/`:

### `use-draft-task.ts`

The single source of truth for the pending draft. Lives once in
`SplitLayoutInner` and is shared with both pane halves by props (both halves are
siblings rendered directly in the layout, so no new context is needed).

State: `{ name: string; startDate?: string; endDate?: string }`.

API:

- `name`, `startDate`, `endDate` — current draft values.
- `setName(value)` — update the name.
- `beginDrag(e)` — pointer-down on the canvas lane; owns pointermove/pointerup,
  writing `startDate`/`endDate` from the drag and clearing them on cancel.
- `dragging` — whether a sketch drag is in progress (drives the ghost bar).
- `commit()` — calls `useCreateTask(projectId)` with
  `{ name, ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) }`
  (identical payload shape to `CreateTaskDialog`). No-op when the trimmed name is
  empty or a create is already in flight.
- `cancel()` — clear name, dates, and any in-progress drag.
- `isPending` — a create mutation is in flight (disables the input, shows a
  spinner, ignores repeat Enter).

Commit success (mutation `onSuccess` already invalidates the task list) refetches
tasks; the new task lands in `items` (dated) or `undatedTaskRows` (undated). The
hook then clears the draft and keeps the input focused for rapid successive entry.

### `draft-range.ts`

Pure helper, unit-tested in isolation (mirrors the existing `estimateFromDrag`
helper style):

```
draftRangeFromDrag(
  startClientX: number,
  currentClientX: number,
  laneRect: DOMRect,
  geom: Geometry,
  today: number,
): { startDate: string; endDate: string }
```

Maps two client-X positions to inclusive UTC day boundaries using
`percentToMs` + `startOfUtcDay` + `toUtcDateString` (the same conversion
`items-layer.tsx`'s `startTsFromClientX` already performs). Normalizes so start ≤
end regardless of drag direction. A drag whose horizontal travel is below a small
threshold is treated as a click and seeds a default
`DEFAULT_SCHEDULE_SPAN_DAYS` (7-day) span anchored at the clicked day — reusing the
existing undated click-to-schedule behavior/constant.

### `DraftRow.tsx`

Two presentational halves, positioned at `rowTop(draftRowIndex)` /
`height: ROW_HEIGHT` so they align with real rows:

- **`DraftTableCell`** (rendered in the table column, `width: tableWidth`): a `+`
  glyph in the warning slot, an inline `Input` bound to `name`
  (`onChange → setName`, `Enter → commit`, `Escape → cancel`), and a Dates column
  showing the sketched range or "No dates". Markup mirrors `TimelineTable`'s row
  so columns line up.
- **`DraftLane`** (rendered in the items viewport, `width: viewportWidth`): a
  transparent, `pointer-events-auto` drag surface at `ROW_HEIGHT`. `onPointerDown
  → beginDrag`. While `dragging` (or dates are set), renders a dashed ghost bar
  reusing the `timeline-undated-preview` styling (dashed primary border, primary
  tint), positioned via `getPercentageOffset`.

## Wiring

- `SplitLayout` gains one optional prop, `projectId?: string`, passed from
  `TimelineView` (which already owns `projectId`).
- `SplitLayoutInner`:
  - Instantiates `useDraftTask(projectId)` when `projectId` is set and the table
    is not collapsed.
  - Includes the draft row in the virtualizer `count`
    (`rowCount = rows.length + undatedTaskRows.length + (draftEnabled ? 1 : 0)`).
  - Renders `DraftTableCell` at the bottom of the table column and `DraftLane` at
    the bottom of the items viewport.
- `contentHeight` used by both `TimelineTable` and `ItemsLayer` must account for
  the extra row so scroll height matches. The draft row's presence is derived the
  same way in both panes (from `projectId` + collapsed), so they stay in lockstep.

No changes to the API contract, `useCreateTask`, `TimelineDataProvider`, or the
undated-row rendering.

## Edge cases

- **Empty/whitespace name** — `commit()` is a no-op; the input's Enter is
  effectively disabled. A drag with no name simply holds the pending dates until a
  name is typed.
- **Escape** — `cancel()` clears name, dates, and the ghost.
- **Click (negligible drag) on the lane** — seeds a default 7-day span at the
  clicked day and focuses the input.
- **Create in flight** — input disabled with a spinner; repeat Enter ignored.
- **Table collapsed / no projectId** — draft row not rendered; toolbar modal is the
  fallback.
- **Successful create** — draft cleared, input stays focused for the next entry.

## Testing

- `draft-range.test.ts` — forward drag, backward drag (normalization), single-day,
  click-to-default-span, across zoom levels.
- `use-draft-task.test.ts` — name-only commits the undated payload; drag + name
  commits the dated payload; empty name blocks commit; Escape clears; success
  resets and refocuses; in-flight blocks repeat commit.
- `DraftRow` component test — renders at the footer row, Enter-to-create wiring,
  ghost appears during a drag — following the existing `create-task-dialog.test.tsx`
  and `scheduler-view.test.tsx` patterns.

## Non-goals

- Removing or changing the existing `CreateTaskDialog` modal.
- Adding a draft row to the **scheduler** view.
- Assignee selection in the draft row (new tasks are created unassigned; assign
  later via existing flows).
- Creating subtasks / choosing a parent from the draft row (top-level tasks only).
- A sticky/always-visible entry point (possible cheap follow-up, out of scope here).
