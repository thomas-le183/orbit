# Scheduler: horizontal move + edge resize (Slice 1)

**Date:** 2026-07-03
**Status:** Approved for planning
**Area:** `apps/web/src/components/timeline/scheduler/`

## Problem

Scheduler bars can be selected and vertically resized (estimatedTime), but they
cannot be moved in time or have their duration changed. This slice adds
**horizontal drag-to-reschedule** and **left/right edge resize** to scheduler
bars, mirroring the Gantt (`bars/`) interaction. It is the first of two slices;
Slice 2 adds vertical lane-drag reassignment.

Scope: scheduler-only. The Gantt `bars/` view is not modified — its pure math is
reused.

## Decisions

- **Behaviors:** body drag = move (shift start+end together, keep duration);
  left edge = change start date; right edge = change end date.
- **Snapping:** whole-day, matching the ISO `startDate`/`endDate` model and the
  Gantt. Min duration 1 day.
- **Reuse:** the pure helpers already exported from
  `bars/use-bar-interaction.ts` — `pxToDays`, `applyMove`, `applyResize`,
  `rangeToDates`, and the `ResizeEdge` type — plus `useEdgeAutoScroll` from
  `bars/use-edge-autoscroll.ts`. No Gantt files change.
- **Live draft:** the in-progress gesture produces a draft range that overrides
  the **active bar's** rendered `left`/`width` directly in `scheduler-lanes.tsx`
  (the draft is NOT injected into `layoutScheduler`, so packing/lanes stay stable
  and the bar slides smoothly instead of re-packing mid-drag). Committed
  day-snapped on release.
- **Persistence:** on commit, `updateItem(id, { startDate, endDate })` for
  instant local reflect, plus `scheduleTask(id, startDate, endDate)` (already in
  the data context → `updateTask.mutate`) to persist to the backend when a
  `projectId` is present. In seed/demo mode `scheduleTask` no-ops server-side;
  the local update still applies.
- **Click vs drag:** the bar keeps its `onClick` (so keyboard activation still
  selects). The body `pointerdown` starts a `move` gesture with pointer capture;
  on release the hook sets a "was dragged" flag when the pointer moved past a
  small threshold. The bar's `onClick` consumes that flag and skips
  `toggle(select)` when the last sequence was a drag; a stationary tap (flag
  unset) selects normally. Edge/estimate handles call `stopPropagation` on
  `pointerdown` so they never start a body move.
- **Coexistence:** the bottom estimatedTime handle (existing) is unaffected;
  bars now carry left/right/bottom handles plus a body-move affordance.

## Gesture hook — `use-bar-drag.ts` (new, scheduler dir)

Follows the pointer lifecycle of `useEstimateResize` / `useBarInteraction`
(pointer capture, `window` listeners, unmount cleanup, single-gesture guard),
with horizontal day-snapping and edge-autoscroll. Interface:

```ts
export type DragRole = "move" | "resize-start" | "resize-end";

export function useBarDrag(opts: {
  onCommit: (id: string, dates: { startDate: string; endDate: string }) => void;
}): {
  draft: { id: string; range: RelativeTimeRangeOffset } | null;
  active: { id: string; role: DragRole } | null;
  beginDrag: (
    e: ReactPointerEvent,
    target: { id: string; role: DragRole; range: RelativeTimeRangeOffset },
  ) => void;
  /** True (once) if the last pointer sequence moved past the drag threshold;
   *  the bar's onClick calls this to skip select after a real drag. */
  wasDragged: () => boolean;
};
```

- On `pointerdown`, records `startX`, sets `active`, seeds `draft` with the
  start range, starts edge-autoscroll.
- Per move frame, `days = pxToDays(dx + panAccumMs * pxPerMs(zoom), zoom)`
  (mirrors `useBarInteraction`'s pan-aware delta); `draft.range =
  role === "move" ? applyMove(range, days) : applyResize(range, edge, days)`.
- On release, converts the final draft range to dates via `rangeToDates(range,
  today)` and calls `onCommit(id, { startDate, endDate })`; clears draft/active,
  releases capture, removes listeners.
- `today` and `zoom` come from `useTimelineController()`; `zoom` is read through
  a ref to avoid stale closures (as in `useBarInteraction`).

## Rendering — `scheduler-lanes.tsx`

- Accept new props: `beginDrag`, `dragDraft: { id: string; range: RelativeTimeRangeOffset } | null`, and `wasDragged: () => boolean`.
- When `dragDraft?.id === item.id`, compute `left`/`width` (and the visibility
  check) from `dragDraft.range` instead of the item's own range, so the active
  bar slides live without re-packing.
- Bar `<button>`: `onPointerDown` starts a `move` gesture
  (`beginDrag(e, { id, role: "move", range })`); `onClick` becomes
  `if (wasDragged()) return; toggle(item.id)`.
- Left/right edge handles (children of the button, task bars): thin
  `cursor-ew-resize` strips at `inset-y-0 left-0 w-1.5` / `right-0 w-1.5`, shown
  via the same CSS reveal as the bottom estimate handle (`group` +
  `group-hover`/`group-data-[selected=true]`). Each `onPointerDown` calls
  `e.stopPropagation()` then `beginDrag(e, { id, role: "resize-start" | "resize-end", range })`.
- The bar body uses `cursor-grab` while idle.

## Wiring — `scheduler-layout.tsx`

`SchedulerLayoutInner` calls `useBarDrag({ onCommit })` where `onCommit(id,
{ startDate, endDate })` does `updateItem(id, { startDate, endDate })` (local)
and `scheduleTask(id, startDate, endDate)` (backend, project mode).

The estimate resizer's `effectiveItems` injection is unchanged (height needs a
relayout). The drag draft is NOT injected — instead `beginDrag`, the drag
`draft`, and `wasDragged` are threaded to `SchedulerLanes`, which overrides the
active bar's `left`/`width` directly. This keeps lanes stable during a move.

## Testing

- **Unit:** the horizontal math is already covered in `bars/`; add a focused
  test only if `use-bar-drag` introduces new pure logic (it should not — it
  composes existing helpers).
- **Interaction (`use-bar-drag.test.ts`, new):** begin→move→commit for each role
  — `move` shifts both dates by the snapped days; `resize-end` extends only the
  end; `resize-start` moves only the start (respecting the 1-day min); draft
  tracks during move and clears on release.
- **Integration (`scheduler-view.test.tsx`):** a pointer drag on a bar body
  moves it and, on release, calls the reschedule path (assert the rendered
  bar's `left` changed, or spy the commit). Requires the existing
  `ResizeObserver` mock so bars render.

## Blast radius

New `use-bar-drag.ts`; edits to `scheduler-lanes.tsx` (handles + body move +
draft range) and `scheduler-layout.tsx` (hook + draft injection). Reuses
`bars/use-bar-interaction.ts` and `bars/use-edge-autoscroll.ts` read-only.
`layout.ts`, `pack-lanes.ts`, and the Gantt view are untouched.
