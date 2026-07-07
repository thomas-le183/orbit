# Scheduler: create task by drag on a row

## Summary

Add drag-to-create in the **scheduler view** (one row per assignee). Dragging
across empty lane space on a person's row sketches a date range, then on release
immediately creates a task pre-assigned to that person for the dragged dates. The
new task's bar enters inline-rename mode so the user can name it in place.

A drag-to-create flow already exists in the **gantt/list view** via a single
trailing "Add task" lane (`draft/`), but nothing equivalent exists in the
scheduler. This spec adds per-row creation to the scheduler only.

## Goals

- Drag on any assignee row (including "Unassigned") to create a task for that
  person over the dragged date range.
- Instant creation with a `"New task"` placeholder, then inline rename on the bar.
- Reuse the existing custom pointer-event pattern and geometry helpers — no new
  drag library.

## Non-goals

- No changes to the gantt/list `draft/` flow.
- No click-to-create; a plain click on empty lane space does nothing new.
- No new fields beyond name/dates/assignee at creation time (priority,
  description, etc. remain the dialog's job).

## Interaction model

On each assignee row, a full-width drag surface sits **behind** the bars:

1. **Pointer down + drag** on empty lane space → sketch a dashed ghost bar over
   the dragged date range (via `draftRangeFromDrag`, as in gantt `DraftLane`).
2. **Pointer up past `DRAG_THRESHOLD_PX` (3px)** → create a task via
   `useCreateTask` with `{ name: "New task", startDate, endDate, assigneeId }`.
   The "Unassigned" row omits `assigneeId`.
3. When the created task's bar renders (after the query refetch), it enters
   **inline-rename mode**: the bar's name `<span>` swaps to a focused,
   text-selected `<input>`. **Enter** or **blur** commits via `useUpdateTask`;
   **Escape** cancels and keeps `"New task"`.

**Click vs. drag:** a real drag past `DRAG_THRESHOLD_PX` is required to create. A
plain click on empty lane space does nothing new — it will not spawn tasks. This
intentionally differs from the gantt draft lane (which treats a near-zero click
as a default span), because empty-space clicks in the scheduler should stay
harmless.

## Components & architecture

Follows the existing hand-rolled pointer-event lifecycle (no dnd-kit), scoped to
the scheduler.

### New: `scheduler/use-lane-create.ts`

A hook mirroring `DraftLane`'s pointer lifecycle. Given geometry and the target
row's assignee, it:

- Tracks an in-progress `{ startDate, endDate }` draft during the drag.
- On pointer-up past `DRAG_THRESHOLD_PX`, calls `create.mutateAsync(...)` and
  records the returned id.
- Exposes `{ draft, beginCreate, renamingId, clearRenaming }`.
- Uses a single-gesture guard (`listenersRef`) and window `pointermove` /
  `pointerup` listeners with cleanup on up/unmount, matching `DraftLane` and
  `useBarDrag`.

### Per-row create surface (in `scheduler-lanes.tsx`)

One `pointer-events-auto` div per row at `row.top` / `row.height`, behind the
bars, `cursor-crosshair`, calling `beginCreate(e, row.assignee)`. Bars remain on
top and `pointer-events-auto`, so dragging a bar still moves it; dragging empty
space creates.

### Ghost bar

Reuse the dashed-preview markup from `DraftLane` (`getPercentageOffset` for
left/right edges), rendered on the active row during the drag.

### Inline rename on the bar (in `scheduler-lanes.tsx`)

When `renamingId === item.id`, render an `<input>` in place of the name `<span>`
(autofocus + select-all via a mount effect). Enter/blur → `useUpdateTask`;
Escape → `clearRenaming`. Small, self-contained addition to the existing bar
`<button>`.

### Wiring (in `scheduler-layout.tsx`)

`scheduler-layout.tsx` owns `useLaneCreate` (it already owns `useBarDrag`) and
passes `beginCreate`, `draft`, `renamingId`, `clearRenaming` down to
`SchedulerLanes`.

## Data flow

drag → local `draft` range → pointer-up → `useCreateTask` POST
(`name:"New task"`, `startDate`, `endDate`, `assigneeId?`) → returns `Task` with
`id` → set `renamingId = id` → query invalidates + refetches → bar renders →
focused input → `useUpdateTask` PATCH on commit (optimistic; already built).

## Edge cases

- **Unassigned row** → omit `assigneeId` (creates an unassigned task).
- **Create fails** → existing `useCreateTask` error toast fires; rename mode is
  not entered.
- **Rename to empty** → keep `"New task"`, don't PATCH an empty name (matches the
  gantt draft's non-empty guard).
- **Escape / blur with unchanged name** → no PATCH, just exit rename mode.
- **Concurrent gestures** → single-gesture guard (`listenersRef`).
- **`estimatedTime` unset** → `barHeight` clamps to its 24px minimum; the bar is
  still visible and renamable.

## Testing (Vitest, colocated)

- `use-lane-create.test.ts` — drag past threshold creates with correct dates +
  `assigneeId`; below threshold does nothing; unassigned row omits `assigneeId`.
- `scheduler-lanes.test.tsx` — create surface renders per row; ghost bar shows
  during drag; bar enters rename mode when `renamingId` matches; Enter commits,
  Escape cancels, empty name is not persisted.
- `draft-range` math is already covered; reuse it.

Mirrors existing `use-bar-drag.test.ts` / `scheduler-view.test.tsx` conventions.

## Relevant existing code

- `apps/web/src/components/timeline/draft/draft-row.tsx` — `DraftLane` pointer
  pattern + ghost bar to mirror.
- `apps/web/src/components/timeline/draft/draft-range.ts` — `draftRangeFromDrag`.
- `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx` — bar render;
  add create surface + inline rename here.
- `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx` — owns
  `useBarDrag`; add `useLaneCreate`.
- `apps/web/src/components/timeline/scheduler/group-rows.ts` — `GroupRow`
  (`assignee`), source of the row's assignee.
- `apps/web/src/hooks/use-tasks.ts` — `useCreateTask` (returns `Task`),
  `useUpdateTask` (optimistic PATCH).
- `packages/shared/src/schemas/tasks.ts` — `createTaskSchema` (`assigneeId`
  supported on create).
