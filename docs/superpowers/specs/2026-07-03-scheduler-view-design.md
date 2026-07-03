# Scheduler view — design

**Date:** 2026-07-03
**Status:** Approved, ready for implementation planning

## Summary

A new **scheduler** view mode for the project view. It shares the timeline's
layout and time axis, but instead of one row per task it renders **one row per
group** (launch: per assignee). Every task belonging to a group is drawn on that
row, and tasks that overlap in time are **packed into stacked sub-lanes** so no
bars sit on top of each other. The row grows vertically to fit however many
lanes its overlaps require.

The scheduler view scaffold already exists
(`apps/web/src/components/timeline/scheduler-view.tsx`,
`use-view-mode.ts`, and the Customize-menu view switcher). This design replaces
the placeholder body with the real UI.

## Decisions (locked)

- **Grouping (launch):** by **assignee** only. One row per user, plus a trailing
  **"Unassigned"** row. Grouping is behind a `GroupingMode` type so status /
  parent modes can be added later without touching the renderer.
- **Interactivity (launch):** **read-only**. Packed bars with hover highlight
  and click-to-open. No drag, resize, reassign, or dependency links yet.
- **Stacking:** **grow the row to fit all lanes**. Greedy interval packing; each
  task takes the first lane where it does not overlap. Nothing is hidden.
- **Structural approach:** **compose shared timeline primitives** into a
  dedicated `SchedulerLayout` (Approach A). The existing `SplitLayout` /
  `ItemsLayer` timeline path is left untouched.
- **Parent tasks** (tasks that have children) are **excluded** — they are
  organizational containers, not schedulable work. Only leaf dated tasks appear.
- **Milestones** render as **global pinned axis markers** (reusing
  `MilestoneMarkers`), not inside any group row.

## 1. Data layer: grouping + assignee plumbing

### 1a. Resolve assignees (shared improvement)

Currently `mapProjectData` (`apps/web/src/components/timeline/data/map-items.ts`)
drops `task.assigneeId`, so `item.assignee` is always undefined for real
projects — even though `timeline-table.tsx` already reads `item.assignee?.name`.

Extend `mapProjectData` to accept the org member list and resolve
`task.assigneeId` → `TaskAssignee` (`{ id, name, avatarUrl }`), populating
`item.assignee` on each mapped `TimelineItem`. An `assigneeId` that resolves to
no member leaves `assignee` undefined (→ "Unassigned").

`TimelineDataProvider` (`data/context.tsx`) obtains members via `useOrgMembers`
(from `hooks/use-auth.tsx`, returns `{ members: [{ userId, ... }] }`) and passes
them into `mapProjectData`. Mock data already carries `assignee`, so the
no-`projectId` path is unaffected.

This benefits both the scheduler (grouping) and the existing timeline table
(assignee column).

### 1b. Group rows (new pure module)

`apps/web/src/components/timeline/scheduler/group-rows.ts`

`buildGroupRows(items: TimelineItem[], mode: GroupingMode): GroupRow[]`

- `GroupingMode = "assignee"` (only value for now).
- Include only **leaf dated tasks**: `kind === "task"`, has a start/end range,
  and has **no children** (parent containers excluded). Milestones excluded.
- One `GroupRow` per assignee that owns ≥1 such task, sorted by assignee name.
- Tasks with no (resolved) assignee collect into a trailing **"Unassigned"** row.
- `GroupRow = { key, label, assignee?: TaskAssignee, tasks: TimelineItem[] }`.

## 2. Lane packing (the "stacking")

`apps/web/src/components/timeline/scheduler/pack-lanes.ts`

`packLanes(tasks: TimelineItem[], today: number): { lanes: TimelineItem[][]; laneCount: number }`

- Sort tasks by start date.
- For each task, compute its end-inclusive ms range (`+1 day`, matching
  `ownRange` in `controller/layout.ts`). Place it in the **first lane** whose
  last-placed bar ends **on or before** this task's start; otherwise open a new
  lane. Adjacent (touching) ranges may share a lane.
- Pure and independently unit-tested. This is the core algorithm.

## 3. Row metrics (variable height)

`apps/web/src/components/timeline/scheduler/row-metrics.ts`

- `LANE_HEIGHT` constant (bar lane height, analogous to the timeline's
  `ROW_HEIGHT`).
- Each group row height = `max(laneCount, 1) * LANE_HEIGHT` + group padding.
- A prefix-sum of row heights yields each group's vertical top offset.
- No `VirtualRowsProvider`: group counts are small, so all rows render (the
  fixed-height virtualizer does not apply to variable-height rows).

## 4. Components (Approach A composition)

```
SchedulerView                       (replaces the placeholder scaffold body)
└─ TimelineProvider  (weekStart)    reused controller: pan/zoom/offset/today
   └─ SchedulerLayout
      ├─ toolbar   → pan buttons · Today · ZoomControl · CustomizeMenu(viewSwitch)   [reused]
      ├─ header band: left group-column header │ TimeUnitsBar                         [reused]
      └─ body (single vertical scroll)
         ├─ pinned background: TimelineGrid · NowLine · MilestoneMarkers              [reused]
         ├─ left column: group headers (avatar + name + task count), useResizableDivider [reused]
         └─ SchedulerLanes  (new): packed bars positioned via getPercentageOffset
      └─ TimelineScrollbar · usePan                                                    [reused]
```

Reused as-is: `TimelineProvider` / `useTimelineController`, `TimeUnitsBar`,
`TimelineGrid`, `NowLine`, `MilestoneMarkers`, `ZoomControl`, the pan buttons +
`usePan`, `TimelineScrollbar`, `useResizableDivider`, `CustomizeMenu`,
`controller/geometry` (`getPercentageOffset`, `rangeVisibility`).

`SchedulerLanes` (new) is the scheduler analogue of `ItemsLayer`: for each
`GroupRow` × lane × task it computes `left`/`right` from `getPercentageOffset`
and visibility from `rangeVisibility` (including the off-screen flyout chevrons
that jump to the bar), and renders a **read-only** bar — color, truncated name,
progress fill — with hover highlight and click-to-open. No `useBarInteraction`,
no resize handles, no link nodes.

Left column shows one header per group: avatar + name + task count, its height
matching the group's packed height, resizable via `useResizableDivider`.

## 5. Milestones & edge cases

- **Milestones:** reuse the pinned `MilestoneMarkers` in the background band, so
  they read as global vertical markers across all rows.
- **Empty project:** reuse / mirror `TimelineEmptyState`.
- **Loading:** simple skeleton (a few group rows).
- **Error:** same inline "Couldn't load tasks" treatment as `ItemsLayer`.
- **No resolved assignees** (e.g. mock without members): everything lands in
  "Unassigned"; the view still renders.

## 6. Testing

- `pack-lanes.test.ts` — non-overlapping → 1 lane; overlapping → correct lane
  counts; adjacent/touching ranges share a lane.
- `group-rows.test.ts` — assignee grouping, Unassigned bucket, parent-task
  exclusion, milestone exclusion, sort order.
- `map-items.test.ts` — extend for assignee resolution from members, and
  unresolved id → undefined assignee.
- `scheduler-view.test.tsx` — renders group headers; overlapping bars land in
  distinct lanes; milestone markers present; click opens the task.

## Out of scope (follow-ups)

- Drag / resize / reschedule and cross-row drag-to-reassign.
- Status and parent/group grouping modes.
- Lane cap with "+N more" overflow.
- Dependency links in the scheduler.
