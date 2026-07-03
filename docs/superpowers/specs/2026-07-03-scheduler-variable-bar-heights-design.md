# Scheduler: variable bar heights from `estimatedTime`

**Date:** 2026-07-03
**Status:** Approved for planning
**Area:** `apps/web/src/components/timeline/scheduler/`

## Problem

Scheduler bars all render at a uniform height (`LANE_HEIGHT = 32px`). We want
each task's bar height to represent its estimated effort, so a viewer can gauge
relative size at a glance.

## Decisions

- **Height source:** a new optional `estimatedTime` field on `TimelineItem`,
  measured in **minutes**, leaf tasks only.
- **Mapping:** clamped-linear. `height = clamp(estimatedTime * PX_PER_MINUTE,
  MIN_BAR_HEIGHT, MAX_BAR_HEIGHT)`.
- **Fallback:** items without `estimatedTime` (milestones, parent tasks) render
  at `MIN_BAR_HEIGHT`.
- **Lane sizing:** a lane's height is the tallest bar it contains. Shorter bars
  are **top-aligned** within the lane.
- **Packing is unchanged:** `packLanes` performs 1-D interval packing on the
  time axis only. Height is orthogonal and handled entirely during vertical
  stacking.

## Data model

Add to `TimelineItem` in `apps/web/src/data/timeline-items.ts`:

```ts
/** Estimated effort in minutes, leaf tasks only. Drives bar height in scheduler. */
estimatedTime?: number;
```

Populate a representative subset of the demo `timelineItems` with `estimatedTime`
values so the varying heights are visible in the running app.

## Height mapping — `lane-metrics.ts`

Replace the uniform-height constants (`LANE_HEIGHT`, `LANE_PADDING`) and
`groupHeight(laneCount)` with:

```ts
/** Bar height for a task with no estimate (milestones, parents). Matches the
 *  previous fixed bar height of 32 − 4·2 = 24px. Tunable. */
export const MIN_BAR_HEIGHT = 24;
/** Ceiling so one large estimate can't dominate a row. Tunable. */
export const MAX_BAR_HEIGHT = 96;
/** 0.2 → 480min (8h) reaches MAX; ≤120min sits at MIN. Tunable. */
export const PX_PER_MINUTE = 0.2;
/** Vertical gap between stacked lanes within a group. */
export const LANE_GAP = 8;
/** Padding above/below the stack of lanes inside a group row. */
export const GROUP_PADDING = 8;

export function barHeight(item: TimelineItem): number {
  if (item.estimatedTime == null) return MIN_BAR_HEIGHT;
  const raw = item.estimatedTime * PX_PER_MINUTE;
  return Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, raw));
}
```

## Vertical stacking — `layout.ts`

New type and helper (the docstring in `layout.ts` already anticipates
"variable-height stacking"):

```ts
export type PositionedLane = {
  bars: PackedBar[];
  /** Cumulative pixel offset from the start of the lane stack (after GROUP_PADDING). */
  top: number;
  /** Lane height = tallest bar in the lane. */
  height: number;
};
```

`stackLanes(lanes: PackedBar[][])` walks the packed lanes, computing for each:

- `height` = `max(barHeight(bar.item))` over its bars,
- `top` = running sum of prior lane heights plus `LANE_GAP` between lanes.

It returns the positioned lanes plus the group's total height:
`sum(laneHeights) + LANE_GAP*(laneCount-1) + GROUP_PADDING*2`. An empty group
(no lanes — not expected, since groups are built from tasks) falls back to
`MIN_BAR_HEIGHT + GROUP_PADDING*2`.

`SchedulerRow.lanes` changes from `PackedBar[][]` to `PositionedLane[]`.
`layoutScheduler` calls `packLanes` (unchanged) then `stackLanes`, and uses the
returned height instead of `groupHeight`.

## Renderer — `scheduler-lanes.tsx`

The uniform-multiply positioning:

```ts
const top = row.top + GROUP_PADDING + laneIndex * LANE_HEIGHT + LANE_PADDING;
```

becomes lane-relative and top-aligned:

```ts
// iterate row.lanes (PositionedLane[]) instead of PackedBar[][]
const top = row.top + GROUP_PADDING + lane.top;   // lane.top is cumulative
const height = barHeight(item);                    // per-bar, top-aligned
```

`barHeight` replaces the module-level `const barHeight = LANE_HEIGHT - LANE_PADDING*2`.

## Testing

New unit tests:

- `barHeight`: fallback when `estimatedTime` absent; clamp at floor (small
  estimate) and ceiling (large estimate); proportional value in the linear band.
- `stackLanes`: cumulative `top` offsets with `LANE_GAP`; each lane height equals
  its tallest bar; total group height formula.

Update existing tests for the new shape / constants:

- `layout.test.ts` — `SchedulerRow.lanes` is now `PositionedLane[]`; height
  assertions use the new mapping.
- `scheduler-view.test.tsx` — any references to `LANE_HEIGHT` / fixed heights.

## Blast radius

Contained to `apps/web/src/components/timeline/scheduler/` plus the
`estimatedTime` field addition in `data/timeline-items.ts`. `pack-lanes.ts` is
**not** modified.
