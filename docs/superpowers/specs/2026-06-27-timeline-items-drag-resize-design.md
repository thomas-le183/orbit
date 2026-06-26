# Timeline Items: Hierarchy + Drag/Resize — Design

Extends the calendar-axis timeline beyond flat tasks to a **task hierarchy**
(parent tasks containing subtasks) plus **milestones** (point markers), and makes
bars **interactive**: drag to move, drag edge handles to resize. All positioning
continues to ride the single `ms → %` mapping documented in
`docs/superpowers/specs/timeline-calculations.md`.

Code lives in `apps/web/src/components/timeline/`.

## Goals

- One unified item model covering leaf tasks, parent (container) tasks, and milestones.
- Parent tasks render as a container that wraps their subtask rows; their span is
  **derived** from children (rollup).
- Drag to move a bar; drag left/right edge handles to resize. Snap to whole UTC days.
- Keep a clean persistence seam so a future project/issue backend is a one-hook swap.
- Preserve the existing off-screen fly-out behavior.

## Non-goals (v1, deferred)

- Expand/collapse of parent groups.
- Editing dependency arrows; multi-select drag.
- Backend persistence (mock data + in-memory state for now).
- Background-drag panning (panning stays on wheel + synthetic scrollbar).

## Decisions (locked during brainstorming)

| Decision | Choice |
| --- | --- |
| Vertical layout | Task hierarchy: parent task wraps subtasks in a container; milestones as point markers |
| Pan vs drag | Bars drag/resize on pointer-down; background does **not** pan (wheel + scrollbar only) |
| Snapping | Snap to whole UTC day |
| Parent bar | Rollup (derived span); dragging the parent shifts all descendant leaves; parent not directly resizable |
| Persistence | In-memory state now, edits routed through a single `updateItem` seam for a later project/issue backend |

## 1. Data model — `data/timeline-items.ts`

Replaces the flat `Task[]` in `data/tasks.ts`. Flat list + `parentId` self-reference
(the same shape a future `issues` table returns).

```ts
export type TimelineItemKind = "task" | "milestone";

export type TimelineItem = {
  id: string;
  kind: TimelineItemKind;
  name: string;
  parentId: string | null;     // null = top-level
  startDate: string;           // ISO YYYY-MM-DD; milestone: the single date
  endDate: string;             // ISO inclusive; milestone: === startDate
  progress?: number;           // 0–100, leaf tasks only
  color: string;
  assignee?: TaskAssignee;     // reused from existing model
  status?: TaskStatus;
};
```

Semantics:
- **Parent task** — any `task` that has children. Its `startDate`/`endDate` in the
  data are ignored; the rendered range is **derived** from descendants.
- **Leaf task** — a `task` with no children. Uses its own dates; draggable + resizable.
- **Milestone** — `kind: "milestone"`, zero duration (`endDate === startDate`),
  rendered as a diamond. May be top-level or a child. Draggable (single date), not resizable.

Seed data includes at least: two parent tasks, several subtasks under each, and a
couple of milestones (one top-level, one nested) so every rendering path is exercised.

`data/projects.ts` is left untouched and is not consumed by the timeline in v1.

## 2. Layout — `controller/layout.ts` (pure, tested)

A pure function transforms the flat list into render instructions. No React, no DOM —
unit-tested like `geometry.ts` / `make-units.ts`.

```ts
type RenderRow = {
  item: TimelineItem;
  depth: number;             // 0 = top-level, 1 = subtask, …
  range: { from: number; to: number };  // ms-offsets-from-today (derived for parents)
  rowIndex: number;          // vertical slot (0-based, in document order)
  isParent: boolean;
};

type ContainerRect = {
  parentId: string;
  range: { from: number; to: number };  // derived horizontal span
  rowStart: number;          // first row index in the group (the parent row)
  rowEnd: number;            // last descendant row index (inclusive)
};

function layoutItems(
  items: TimelineItem[],
  today: number,
): { rows: RenderRow[]; containers: ContainerRect[] };
```

Algorithm:
1. Build a tree from `parentId` (preserve input order among siblings).
2. **Rollup** (post-order): a parent's `range` = `{ from: min(child.from), to: max(child.to) }`.
   Leaf/milestone range comes from its own dates:
   `from = startOfUtcDay(startDate) - today`,
   `to   = startOfUtcDay(endDate) - today + ONE_DAY` (milestone: `to === from + ONE_DAY`
   for hit area; rendered as a point at `from`).
3. **Flatten** depth-first into `rows`, assigning `rowIndex` in document order.
4. Emit a `ContainerRect` for every parent, spanning its derived range horizontally and
   `[parent row … last descendant row]` vertically.

Edge cases: a parent with no children falls back to its own dates (treated as a leaf);
empty list → empty rows/containers.

## 3. Interaction — `use-bar-interaction.ts` (pure math tested)

Pointer-driven move/resize. Background panning is already disabled, so bar handlers own
pointer-down. Wheel still pans.

| Target | Action |
| --- | --- |
| Leaf task body | Move — shift `from`/`to` together |
| Leaf task left handle | Resize start, clamped so duration ≥ 1 day |
| Leaf task right handle | Resize end, clamped so duration ≥ 1 day |
| Parent body | Move whole group — shift every descendant **leaf**'s dates by the same delta |
| Parent edges | No handles (derived span) |
| Milestone | Move single date |

Mechanics:
- On pointer-down: `setPointerCapture`, record start `clientX` and the item's original range.
- On pointer-move: `dms = dx * msPerPx(zoom)` where `msPerPx = 1 / pxPerMs(zoom)`.
  Snap `dms` to whole days (`Math.round(dms / ONE_DAY) * ONE_DAY`) so the bar steps
  day-by-day on the grid.
- A **draft override** (item id → provisional range) drives rendering during the gesture;
  the committed data is untouched until release.
- On pointer-up: convert the draft range back to ISO dates and call `updateItem`; clear draft.

Pure, extracted, tested helpers:
```ts
pxToDays(dx, zoom): number                          // snapped day delta
applyMove(range, days): range
applyResize(range, edge, days, minDays = 1): range  // enforces 1-day floor
rangeToDates(range, today): { startDate, endDate }
```

Stop propagation on bar pointer handlers so gestures never leak to other layers.

## 4. State & persistence seam — `use-timeline-items.ts`

```ts
function useTimelineItems(): {
  items: TimelineItem[];
  updateItem: (id: string, patch: Partial<TimelineItem>) => void;
};
```

v1: `useState` seeded from `data/timeline-items.ts`. Moving a parent expands to multiple
`updateItem` calls (one per descendant leaf) or a batched update — implementation detail
behind this hook. When the backend arrives, this hook swaps `useState` for a TanStack
Query list + mutation; no consumer changes.

## 5. Components — `items-layer.tsx` (replaces `task-bars.tsx`)

`items-layer.tsx` consumes `useTimelineItems()` + `layoutItems()` and renders, per row:

```
items-layer.tsx
 ├─ ParentContainer   // wrap box (subtle bg/border) + derived summary bar; drag = move group
 ├─ TaskBar           // body + left/right resize handles + progress fill; drag/resize
 ├─ MilestoneMarker   // diamond at range.from; drag = move date
 └─ ItemFlyout        // generalized off-screen fly-out (was inline in task-bars)
```

- Row vertical geometry reuses the current `ROW_HEIGHT` / `ROW_PADDING` constants, indented
  by `depth`.
- Horizontal geometry via `getPercentageOffset(range.from / range.to)` — unchanged mapping.
- Off-screen items (`rangeVisibility` → `left`/`right`) render an `ItemFlyout` chip that
  calls `scrollToMs(center)`; this is the existing behavior, extracted.
- `task-bars.tsx` and `task-bars.test.tsx` are removed; the container wires `<ItemsLayer />`
  where `<TaskBars />` was.

## 6. Testing

- `layout.test.ts` — rollup ranges, flatten/`rowIndex` order, container rects, no-children
  parent fallback, empty input.
- `use-bar-interaction.test.ts` — `pxToDays` snapping, `applyMove`, `applyResize` 1-day floor
  on both edges, `rangeToDates` round-trip.
- `items-layer.test.tsx` — renders a parent container + its subtask rows + a milestone;
  simulated pointer drag on a leaf updates state; resize handle changes `endDate`; off-screen
  item shows a fly-out (carried over from `task-bars.test.tsx`).

## Open risks

- **Parent move = N updates**: dragging a parent edits all descendant leaves. Fine for mock
  state; the future backend mutation should accept a batch to stay atomic. Noted for the
  backend phase.
- **Pointer capture vs wheel**: wheel panning during an active drag is possible; acceptable
  in v1 (drag uses captured pointer; wheel independently pans). Revisit if it feels janky.
