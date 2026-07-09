# Scheduler drag range highlight

**Date:** 2026-07-09
**Status:** Approved, pending implementation

## Problem

When a user drags or resizes a task bar in the scheduler, they get feedback on the
vertical (assignee) axis — `scheduler-lane-drop-target` tints the row the bar will
land in. They get no feedback on the horizontal (time) axis. The bar moves, but
nothing tells the user which dates it will commit to.

Drags snap to whole days, so the bar's pixel position alone is ambiguous near a day
boundary. And at `quarters` or `years` zoom the header labels are too coarse to read
a precise date off of.

The Gantt view already solves half of this and the scheduler never inherited it.

## Goals

1. Show the exact dates a drag will commit, at every zoom level.
2. Show where those dates sit relative to the rest of the timeline.
3. Reuse the Gantt's existing drag tooltip rather than building a second one.

## Non-goals

- Adding the header highlight to the Gantt view. The drag-range context is designed
  to permit it later, but only the scheduler wires up a provider now.
- Changing any date math, snapping behavior, or commit path.

## Background: the `to` convention

`rangeToDates` (`bars/use-bar-interaction.ts`) computes:

```ts
endDate: toUtcDateString(today + range.to - ONE_DAY)
```

So the two conventions coexist deliberately:

- `range.to`, the **offset**, is **exclusive** — it points at the start of the day
  *after* the last covered day.
- `endDate`, the **string**, is **inclusive** — it names the last covered day, and
  is what the API stores.

This explains an apparent contradiction in the existing code. The bar's right edge
(`scheduler-lanes.tsx`) passes `range.to` straight to `getPercentageOffset`, while
the create-preview adds `ONE_DAY` to its right edge. Both are correct: the preview
starts from date strings, the bar starts from offsets.

Consequences for this work:

- Overlap is plain half-open: `unit.from < range.to && unit.to > range.from`.
- Day count is plain: `(range.to - range.from) / ONE_DAY`.
- No off-by-one correction anywhere.

## Design

### Part A — Header highlight (new)

A drag-range context at `timeline/drag/context.tsx`:

```ts
export function useDragRange(): RelativeTimeRangeOffset | null
```

Defaults to `null` with no provider, mirroring `RowSelectionProvider`'s no-op
default so `TimeUnitsBar` renders unprovided (Gantt, tests).

Context rather than props: the header band and the lanes body are separate branches
of the layout tree, and `TimeUnitsBar` is shared with the Gantt view. Threading a
scheduler-only `dragDraft` prop through a component the Gantt also renders would be
the wrong coupling.

`SchedulerLayoutInner` already holds `dragDraft` from `useBarDrag`, so the provider
is a thin value-passing wrapper around the split region. No new state.

The provider — not `TimeUnitsBar` — applies the gate described below, passing
`active && pointer ? dragDraft.range : null`. `TimeUnitsBar` therefore only ever
sees a range it should highlight, and needs no knowledge of pointer state.

- `TimeUnitsBar` reads the context once and marks each **bottom-row** cell that
  overlaps the range. The top row is untouched.
- `BottomCell` gains `highlighted?: boolean` → `bg-primary/10 text-foreground
  font-medium`, and a `data-highlighted` attribute for tests.
- `overlapsRange(unit, range)` is a pure function in its own module.

### Part B — Drag tooltip (extract and reuse)

`items-layer.tsx` renders a cursor-following `timeline-drag-tooltip`, labelled by
`gestureTooltip(role, range, today)` — which already returns `"Mar 3 – Mar 12"` for
a move, and the single moving edge for a resize.

- Extract that tooltip JSX into a shared `DragTooltip` component.
- Render it from both `items-layer` and `scheduler-lanes`.
- `gestureTooltip` takes a `GestureRole`, structurally identical to the scheduler's
  `DragRole` (same three literals). Reuse it; do not add a second formatter.
- `useBarDrag` tracks `lastPointerX/Y` in a closure but never exposes them. Add a
  `pointer: { x, y } | null` state field, mirroring `useBarInteraction`.

The tooltip derives its dates from `rangeToDates(draft.range, today)` — the same
helper `onUp` uses to commit. The label is therefore guaranteed to show the dates
that will actually be saved, rather than a second derivation that could drift.

### Why `active && pointer` is the right gate

`beginDrag` sets `draft` and `active` on pointerdown, before any movement. Gating
the tooltip on `draft != null` would flash it for a frame on a plain click-to-select.

`pointer` is only set on the first `pointermove`, so `active && pointer` is already
false for a click without movement. This is exactly how the Gantt gates. It needs no
new threshold plumbing, and it gives a purpose to `active`, which `useBarDrag`
currently returns and no caller uses.

Both the tooltip and the header tint gate on this condition.

## Accepted limitation

At `quarters` and `years` zoom the bottom row's cells *are* quarters, so a one-week
drag tints a whole quarter. This is inherent to tinting existing cells, and is why
the tooltip is not optional — it carries the precision at every zoom level. Not
worth special-casing.

## Testing

The web suite OOMs this machine when run whole. Run one file at a time with
`pnpm exec vitest run <path>`. Do **not** use `pnpm test -- --run <path>` — pnpm
swallows the path and Vitest runs all ~51 files.

- `overlapsRange` pure test: touching edges, exclusive end bound, zero-width range.
- `time-units-bar` render test: given a provided range, the expected cells carry
  `data-highlighted` and others do not.
- `scheduler-view` interaction test: pointerdown + move shows the tooltip with the
  expected date label; pointerup removes it; a click with no movement never shows it.
- `items-layer` test: re-run to confirm the `DragTooltip` extraction did not regress
  the Gantt's tooltip.

## Files

| File | Change |
| --- | --- |
| `timeline/drag/context.tsx` | New. `DragRangeProvider`, `useDragRange`. |
| `timeline/drag/overlap.ts` | New. Pure `overlapsRange`. |
| `timeline/drag/drag-tooltip.tsx` | New. Extracted from `items-layer`. |
| `timeline/header/time-units-bar.tsx` | Read context, mark bottom-row cells. |
| `timeline/header/label.tsx` | `BottomCell` gains `highlighted`. |
| `timeline/scheduler/use-bar-drag.ts` | Expose `pointer` state. |
| `timeline/scheduler/scheduler-lanes.tsx` | Render `DragTooltip`. |
| `timeline/scheduler/scheduler-layout.tsx` | Provide drag range. |
| `timeline/bars/items-layer.tsx` | Use extracted `DragTooltip`. |
