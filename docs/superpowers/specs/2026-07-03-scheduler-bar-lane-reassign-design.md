# Scheduler: vertical lane drag to reassign (Slice 2)

**Date:** 2026-07-03
**Status:** Approved for planning (build after Slice 1)
**Area:** `apps/web/src/components/timeline/scheduler/`
**Depends on:** Slice 1 (`use-bar-drag.ts`, the move gesture).

## Problem

Slice 1 lets scheduler bars move in time (X) and resize. This slice makes the
body-drag **2D**: dragging a bar also moves it **vertically between assignee
lanes**, reassigning the task to that assignee. Moving in time and reassigning
happen in a single gesture, committed together on release.

Scope: scheduler-only. Extends the Slice 1 gesture hook; no Gantt changes.

## Decisions

- **One 2D drag:** the `move` role tracks pointer X **and** Y. On release, commit
  both the new dates (from X) and the new `assigneeId` (from Y, if the target
  lane's assignee differs).
- **Drop feedback:** the dragged bar **follows the cursor vertically** (its
  rendered `top` tracks the pointer), and the **target lane row is highlighted**
  while hovered. The trailing **"Unassigned"** row is a valid drop target.
- **Hit-testing:** the target lane is the row whose `[top, top+height)` band
  contains the pointer Y (in the scroll container's coordinate space). Rows come
  from the existing layout (`SchedulerRow[]` — each has `top`, `height`, `key`,
  `assignee?`).
- **Reassign commit:** if the target row's assignee differs from the task's
  current assignee, `updateItem(id, { assignee: targetAssignee })` (local, so the
  task re-buckets into the new lane immediately) plus, in project mode,
  `updateTask.mutate({ id, input: { assigneeId: targetAssignee.id } })`.
- **Persistence caveat:** the backend `assigneeId` is a member/user UUID. In
  project mode the row's `assignee.id` is that real id and reassignment
  persists. In seed/demo mode assignee ids are placeholders (`"u_maya"`) and
  there is no `projectId`, so reassignment is **local-only** there. This is
  documented behavior, not a bug.

## Gesture hook changes — `use-bar-drag.ts`

Extend the hook (do not fork it):

- `beginDrag` for `role: "move"` additionally records `startY` and accepts the
  row geometry needed for hit-testing. The hook is given the rows (or a
  `resolveLaneAt(clientY): { key: string; assignee?: TaskAssignee } | null`
  callback) so it stays decoupled from layout internals.
- The `draft` for a move gains a vertical target:

```ts
draft: {
  id: string;
  range: RelativeTimeRangeOffset;   // X (Slice 1)
  targetLaneKey?: string;           // Y: row the pointer is over
  pointerTop?: number;              // for the bar-follows-cursor render
} | null;
```

- Per move frame, in addition to the X computation, resolve the lane under
  `clientY` and set `targetLaneKey`/`pointerTop`.
- On release, `onCommit` is extended to carry the reassignment:

```ts
onCommit: (
  id: string,
  dates: { startDate: string; endDate: string },
  targetLaneKey: string | null,
) => void;
```

Resize roles (`resize-start`/`resize-end`) are unaffected — no Y tracking.

## Rendering — `scheduler-lanes.tsx`

- When `draft?.id === item.id` and the drag is a `move`, render the bar at
  `pointerTop` (cursor-following) instead of its packed lane `top`.
- Render a **target-lane highlight** overlay for the row whose `key ===
  draft.targetLaneKey` (a translucent band spanning that row).
- The group column (`scheduler-layout.tsx` `GroupHeader`) may also highlight the
  target assignee; optional, keep minimal.

## Wiring — `scheduler-layout.tsx`

- Provide the hook a `resolveLaneAt(clientY)` built from `rows` and the scroll
  container's rect (map viewport Y → content Y using `scrollContainerRef`'s
  bounding rect + `scrollTop`).
- `onCommit(id, dates, targetLaneKey)`:
  - Always apply dates (Slice 1 path).
  - If `targetLaneKey` resolves to a row whose assignee differs from the task's
    current assignee: `updateItem(id, { assignee })` (local) and, when
    `projectId` and the target has a real assignee, `updateTask.mutate({ id,
    input: { assigneeId: assignee.id } })`.
  - **Unassign limitation:** dropping on the "Unassigned" row clears the
    assignee locally (`updateItem(id, { assignee: undefined })`), but the backend
    cannot persist an unassign — `updateTaskSchema.assigneeId` is
    `z.string().uuid().optional()` with no `null`, and `.partial()` means an
    omitted key is a no-op, not a clear. So unassign is **local-only** until the
    schema gains a nullable `assigneeId`. Reassign to a real assignee persists
    normally. (Flagged as a follow-up, not addressed in this slice.)

## Testing

- **Interaction (`use-bar-drag.test.ts`):** a `move` gesture with vertical
  movement resolves the correct `targetLaneKey` via the injected
  `resolveLaneAt`; on release `onCommit` receives the target key; a drag that
  stays within the origin lane yields the same lane (no reassign).
- **Integration (`scheduler-view.test.tsx`):** dragging a bar from one
  assignee's lane into another's and releasing re-buckets it into the target
  lane (assert the bar now renders under the target row / the group counts
  change). Uses the existing `ResizeObserver` mock; hit-testing may need a
  stubbed `getBoundingClientRect` in jsdom/happy-dom.

## Blast radius

Extends `use-bar-drag.ts` (2D draft + `resolveLaneAt` + reassign in `onCommit`);
edits `scheduler-lanes.tsx` (cursor-following render + target-lane highlight) and
`scheduler-layout.tsx` (`resolveLaneAt` + reassign commit). `layout.ts`,
`pack-lanes.ts`, and the Gantt view remain untouched.
