# Scheduler row virtualization

## Problem

Scrolling the scheduler is janky once a project has many assignees and many
tasks. The cause is DOM size, not render count: the scheduler's vertical scroll
container
([`scheduler-layout.tsx`](../../../apps/web/src/components/timeline/scheduler/scheduler-layout.tsx#L269))
has no `onScroll` handler and no state derived from `scrollTop`, so scrolling
triggers zero React renders. The cost is browser layout, paint, and compositing
over a tree proportional to (all assignee rows) × (tasks inside the current time
window).

Nothing windows vertically. `SchedulerLayoutInner` maps over every row for the
group column
([L279](../../../apps/web/src/components/timeline/scheduler/scheduler-layout.tsx#L279)),
and `SchedulerLanes` iterates every row → every lane → every bar
([L139](../../../apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx#L139)).
The existing `rangeVisibility` cull
([L143](../../../apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx#L143))
is *horizontal* only — it drops bars scrolled off the time axis, but every row
stays mounted regardless of vertical position.

The Gantt pane already windows its rows via
[`VirtualRowsProvider`](../../../apps/web/src/components/timeline/layout/virtual-rows.tsx),
but that provider is built around a single fixed `ROW_HEIGHT` and an index-based
`isVisible` / `isSpanVisible` contract shaped for its dependency layer. Scheduler
rows are variable-height and have no dependency edges.

## Goal

Make scheduler scroll cost proportional to the viewport rather than to the
project, by rendering only the rows near the viewport. Preserve every existing
interaction: bar drag, cross-lane reassignment, estimate resize, drag-to-create,
and inline rename.

## Scope

- **In scope:** a new `use-scheduler-rows.ts`; `scheduler-layout.tsx` (group
  column positioning, pinned keys, pass `visibleRows`); `scheduler-lanes.tsx`
  (one prop rename).
- **Out of scope:** `layout.ts`, `pack-lanes.ts`, `group-rows.ts`,
  `lane-metrics.ts` are unchanged. The Gantt's `VirtualRowsProvider` is
  untouched — no attempt to generalize it. **No `SchedulerBar` extraction, no
  hover refactor, no resize-handle changes** — the bar JSX, the rename input and
  its `renameCommittedRef`, the create surface, and the drop target are all left
  exactly as they are, to avoid colliding with the recently landed
  drag-to-create and inline-rename work. No data-model or API changes.

Three further optimizations were considered and deliberately deferred; see
Follow-up. None of them address scroll cost.

## Design

### Known-size virtualization

`layoutScheduler` already returns an exact `top` and `height` for every row and a
`totalHeight` for the container. Nothing needs DOM measurement, so this is a
*known-size* variable-height virtualizer: no `measureElement`, no re-measure
pass, no layout thrash.

A scheduler-local hook rather than a shared provider. Both consumers — the group
column and the lanes layer — render from `SchedulerLayoutInner`, which already
holds `rows`; it computes the visible slice once and passes it down as a prop.
No context needed.

### `use-scheduler-rows.ts` (new)

```ts
useSchedulerRows({
  rows: SchedulerRow[],
  scrollRef: RefObject<HTMLDivElement | null>,
  pinnedKeys: ReadonlySet<string>,
}): { visibleRows: SchedulerRow[] }
```

Wraps `useVirtualizer({ count: rows.length, estimateSize: (i) => rows[i].height,
getScrollElement: () => scrollRef.current, overscan: 2 })`.

- **Overscan is 2**, not the Gantt's 8. Scheduler rows are variable and a row
  with many lanes can exceed the viewport height; eight of them is a lot of DOM.
  A starting point, to tune against bulk seed data.
- **Unmeasured-viewport fallback.** If `getVirtualItems()` is empty or the
  scroll element's `clientHeight` is 0, return all rows. This mirrors the Gantt
  provider's escape hatch: it avoids an empty-pane flash on first mount, and it
  keeps the existing jsdom tests green without modification, since `clientHeight`
  is 0 there.
- **Pinned rows.** A row involved in a live gesture must stay mounted even when
  scrolled out, or the bar under the cursor unmounts mid-drag. `pinnedKeys` is
  unioned into the visible slice and the result re-sorted by row index, so render
  order matches document order.

`visibleRows` is a `SchedulerRow[]` — the same shape both consumers already take,
so neither learns anything about virtualization.

### Pinned keys, computed in `scheduler-layout.tsx`

Four sources, all already in scope in `SchedulerLayoutInner`:

| Source | Row to pin |
| --- | --- |
| `dragDraft.id` | the row whose lanes contain that bar (drag origin) |
| `dragDraft.targetLaneKey` | the drop-target row |
| `createDraft.laneKey` | the row being dragged on to create |
| `renamingId` | the row whose lanes contain the bar being renamed |

`dragDraft.id` and `renamingId` are item ids, not row keys, so both need a lookup
over `rows[].lanes[].bars[]`. Memoize an `itemId → rowKey` index keyed on `rows`
and reuse it for both.

### `scheduler-layout.tsx`

The group column
([L279](../../../apps/web/src/components/timeline/scheduler/scheduler-layout.tsx#L279))
stacks `GroupHeader` divs in normal document flow, so skipping rows would
collapse the layout. It becomes a `position: relative` container of
`height: totalHeight`. Each `GroupHeader` is wrapped in an absolutely-positioned
div carrying `top: row.top` and `height: row.height`.

The **wrapper** matters: `GroupHeader`'s inner `sticky top-0` element keeps the
assignee name visible on tall rows, and sticky positioning inside an
absolutely-positioned parent is a behavior we do not want to depend on. Wrapping
leaves the header's internals in normal flow, so the sticky element keeps an
ordinary block parent and behaves exactly as it does today. `GroupHeader` itself
is unchanged apart from no longer setting its own `height`.

Both panes then map over `visibleRows` instead of `rows`.

`resolveLaneAt`
([L131](../../../apps/web/src/components/timeline/scheduler/scheduler-layout.tsx#L131))
continues to close over the **full** `rows` array. It hit-tests by coordinate
math, not by DOM, so lane targeting keeps working when a drag passes over a
culled row. This is load-bearing and must not be switched to `visibleRows`.

### `scheduler-lanes.tsx`

Rename the `rows` prop to `visibleRows`. Nothing else changes. The horizontal
`rangeVisibility` cull stays as-is and now runs over far fewer bars.

## Testing

- **Regression first.** The eight existing tests in `scheduler-view.test.tsx`
  must pass **unmodified**, via the unmeasured-viewport fallback. Run these
  before writing new tests — a failure there means the fallback is wrong.
- **`use-scheduler-rows.test.ts` (new).** Unit-test the slice logic as a pure
  function of (rows, scrollTop, viewportHeight, pinnedKeys) → visible row keys.
  Cover: empty rows; unmeasured viewport → all rows; a row taller than the
  viewport; a pinned key far outside the window is included and correctly
  ordered.
- **`scheduler-view.test.tsx` (extend).** One integration test that stubs the
  scroll container's `clientHeight` and asserts a far-offscreen assignee's
  `scheduler-group-header` is absent, while a pinned dragging row stays present.

Per `CLAUDE.md`, run Vitest scoped to single files
(`cd apps/web && pnpm test -- scheduler`) rather than the full suite, which
exhausts memory on this machine.

## Risks

- **Overscan of 2 is a guess.** A single row can exceed the viewport height. Too
  low produces blank rows on fast scroll. Tune against bulk seed data.
- **Pinning is the likely bug source.** A missed pin unmounts the bar under the
  cursor mid-gesture. The four sources above are believed exhaustive, but any
  future gesture spanning rows must add its own pin.

## Follow-up (not in this spec)

Each of these is real, and none of them affects scroll cost — scrolling
re-renders nothing. They are ordered by expected value.

1. **Hover is shared React state.** `hoveredId` lives in `RowSelectionContext`,
   so every `mouseenter` / `mouseleave` changes the context value and re-renders
   every bar at pointer-move frequency. In the scheduler, `hovered` feeds exactly
   one expression
   ([L158](../../../apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx#L158)) —
   the `(selected || hovered)` ring on the bar itself — with none of the Gantt's
   cross-pane needs. Fix by extracting a per-bar `SchedulerBar` component holding
   hover in local `useState`. Deferred because that extraction collides with the
   drag-to-create and inline-rename code that just landed.

2. **Invisible resize handles.** Each bar mounts three `opacity-0` resize
   affordances (bottom
   [L257](../../../apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx#L257),
   start
   [L268](../../../apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx#L268),
   end
   [L280](../../../apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx#L280)) —
   roughly half of every bar's subtree, invisible but occupying layout and
   composited. Mount them only when the bar is hovered or selected. Depends on
   (1), since gating on hover requires hover state that doesn't re-render the
   world. Virtualization also makes this far less urgent by shrinking the number
   of live bars.

3. **Per-frame relayout during estimate resize.** `useEstimateResize` calls
   `setDraft` on every `pointermove`, invalidating `effectiveItems`
   ([L103](../../../apps/web/src/components/timeline/scheduler/scheduler-layout.tsx#L103))
   and therefore the `layoutScheduler` memo
   ([L115](../../../apps/web/src/components/timeline/scheduler/scheduler-layout.tsx#L115)),
   re-running `buildGroupRows`, `packLanes` (which sorts), and `stackLanes` for
   every group in the project once per frame — although only one row's geometry
   can have changed. Fix by coalescing `setDraft` to one update per
   `requestAnimationFrame` (cheap, most of the benefit) or by relayouting only
   the affected group and splicing it into the previous `rows` (correct).
