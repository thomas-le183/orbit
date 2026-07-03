# Scheduler: bottom-edge resizer to adjust `estimatedTime`

**Date:** 2026-07-03
**Status:** Approved for planning
**Area:** `apps/web/src/components/timeline/scheduler/`

## Problem

Scheduler bars render at a height derived from each task's `estimatedTime`
(see the variable-bar-heights feature). There is no way to change that estimate
directly. We want a resize handle on the **bottom edge** of a scheduler bar that
lets the user drag vertically to adjust the task's `estimatedTime`.

Scope note: this handle is **scheduler-only**. The Gantt (`bars/`) view has its
own horizontal move/resize and is untouched.

## Decisions

- **Affordance:** a thin grab strip pinned to the bottom edge of each bar,
  `cursor-ns-resize`, visible on hover or when the bar is selected.
- **Applies only to** `item.kind === "task"` bars (estimatedTime is a task
  concept; milestones are excluded).
- **Drag range:** the clamped visual band. Height 24–96px maps to estimatedTime
  120–480 min. Dragging cannot set values outside this band — the bar height
  always faithfully reflects the value.
- **Snapping:** estimatedTime snaps to the nearest 30 minutes during the drag.
- **Live relayout:** the whole scheduler reflows smoothly during the drag (rows
  below shift as the dragged bar grows/shrinks) by injecting a draft estimate
  into the items list before layout. No overlap/overflow hacks.
- **Persistence:** local only, via the existing `updateItem(id, patch)`. The
  backend/shared task schema has no `estimatedTime` column, so there is no
  server round-trip. Edits persist in memory until a data refetch replaces
  `items`. Server persistence is a separate migration, out of scope.
- **Click safety:** `pointerdown` on the handle calls `stopPropagation` so it
  never triggers the bar's select-on-click.

## The math — `lane-metrics.ts`

Invert the existing `barHeight` mapping, working in height-space:

```ts
export const ESTIMATE_SNAP_MIN = 30;

/** Bottom-edge drag → snapped estimatedTime (minutes), within the clamped band. */
export function estimateFromDrag(startHeight: number, dy: number): number {
  const h = Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, startHeight + dy));
  const raw = h / PX_PER_MINUTE; // 24..96px → 120..480 min
  return Math.round(raw / ESTIMATE_SNAP_MIN) * ESTIMATE_SNAP_MIN; // → {120,150,…,480}
}
```

`startHeight` is `barHeight(item)` captured at gesture start, so a task with no
estimate starts at `MIN_BAR_HEIGHT` (24px / 120 min) and can be dragged upward.

## Gesture hook — `use-estimate-resize.ts` (new, scheduler dir)

Mirrors the pointer pattern of the existing `bars/use-bar-interaction.ts`
(pointer capture, `window` `pointermove`/`pointerup` listeners, cleanup on
unmount, single-gesture guard) but vertical and simpler — no zoom, no
autoscroll. Interface:

```ts
export function useEstimateResize(opts: {
  onCommit: (id: string, estimatedTime: number) => void;
}): {
  draft: { id: string; estimatedTime: number } | null;
  active: string | null; // id being resized, for styling
  beginResize: (
    e: ReactPointerEvent,
    target: { id: string; startHeight: number },
  ) => void;
};
```

- `beginResize` records `startHeight` and start `clientY`, sets `active`, seeds
  `draft` from the start estimate, and attaches window listeners.
- On `pointermove`, `dy = ev.clientY - startY`; `draft = { id, estimatedTime:
  estimateFromDrag(startHeight, dy) }`.
- On `pointerup`, calls `onCommit(id, draft.estimatedTime)`, clears `draft`/
  `active`, releases capture, removes listeners.
- A `pointerdown` while a gesture is active is ignored (single-gesture guard),
  as in `use-bar-interaction`.

## Wiring — `scheduler-layout.tsx` + `scheduler-lanes.tsx`

In `SchedulerLayoutInner`:

```ts
const { updateItem, items } = useTimelineData();
const { draft, active, beginResize } = useEstimateResize({
  onCommit: (id, estimatedTime) => updateItem(id, { estimatedTime }),
});

const effectiveItems = draft
  ? items.map((i) => (i.id === draft.id ? { ...i, estimatedTime: draft.estimatedTime } : i))
  : items;

const { rows, totalHeight } = useMemo(
  () => layoutScheduler(effectiveItems, "assignee", today),
  [effectiveItems, today],
);
```

`beginResize` is passed to `SchedulerLanes`. The handle is a child of the
existing bar `<button>`, rendered only for `item.kind === "task"` bars, and
**always present in the DOM** for those bars — visibility is handled with CSS so
it is queryable in tests. The bar `<button>` gains the `group` class; the handle
is transparent by default and revealed on hover or when the bar is selected (the
button already sets `data-selected={selected}`). The bar's `height` local
(already `barHeight(item)`) is the `startHeight`:

```tsx
{item.kind === "task" && (
  <span
    data-testid="scheduler-bar-resize"
    onPointerDown={(e) => {
      e.stopPropagation();
      beginResize(e, { id: item.id, startHeight: height });
    }}
    className="pointer-events-auto absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
  />
)}
```

`active` from the hook is not needed for visibility (CSS covers hover/selected)
and is not threaded into `SchedulerLanes`; it remains available on the hook for
styling the dragged bar if desired.

## Testing

- **Unit (`lane-metrics.test.ts`):** `estimateFromDrag` — clamp at floor (drag
  up past min → 120), clamp at ceiling (drag down past max → 480), 30-min
  snapping (e.g. a dy landing at ~310 min snaps to 300), start from a
  no-estimate bar (startHeight = MIN_BAR_HEIGHT).
- **Interaction (`use-estimate-resize.test.ts`, new):** begin → move → up
  produces `onCommit(id, expectedMinutes)`; `draft` tracks during move and
  clears after up.
- **Integration (`scheduler-view.test.tsx`):** the resize handle renders on a
  task bar; a pointer drag on it followed by pointerup calls `updateItem` with
  the snapped estimate (assert via the data-context mock).

## Blast radius

New file `use-estimate-resize.ts`; additions to `lane-metrics.ts`
(`ESTIMATE_SNAP_MIN`, `estimateFromDrag`); edits to `scheduler-layout.tsx`
(hook + draft injection) and `scheduler-lanes.tsx` (handle + props). `layout.ts`,
`pack-lanes.ts`, and the Gantt `bars/` view are untouched.
