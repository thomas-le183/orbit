# Project Timeline Data (Read-Path) — Design

**Date:** 2026-06-30
**Scope:** Make the project-scoped timeline (`/$orgSlug/projects/$projectId`) fetch and render that project's tasks as rows, milestones as calendar-axis markers, with local (non-persisted) drag/resize and click-to-create on empty lanes. Frontend only; no new backend.

## Goal

When a user clicks a project in the sidebar, the timeline shows **only that project's** tasks (replacing the static seed). Tasks render as bars; milestones render as markers on the calendar axis. Editing gestures (drag/resize/create) work in-memory but are not yet persisted — persistence is the next (write) slice.

## Decisions

- **Single data source:** replace `useTimelineItems()` (a local `useState` of seed, currently called independently in `ItemsLayer` and `TimelineTable` — three separate states) with a `TimelineDataProvider` (React context) owning one items array, consumed via `useTimelineData()`. Same `{ items, updateItem, moveDays }` interface, plus `isLoading`/`isError`/`projectId`. This also fixes the existing duplicate-state latent bug (edits in one pane never reached the other).
- **Two entry points:** the project route provides `projectId` (fetches real data); the plain `/timeline` route provides no `projectId` (keeps the static seed — no regression).
- **Tasks → rows; milestones → axis markers** (not rows), per product direction.
- **Drag/resize/create are local-only** (in-memory), reset on refetch. Persistence deferred to the write slice.
- **Deferred mappings (omitted this slice):** `assignee` (API returns only `assigneeId`; no name/avatar without a members lookup) and `status` (FK `statusId`, not the FE `TaskStatus` enum). Bars show color + name + progress; the Assignee column stays empty.
- **Conventions:** TanStack Query hooks mirror `use-projects.ts`; context mirrors existing providers (`RowSelectionProvider`, `TimelineProvider`); `@orbit/ui` + `cn()`; Biome tabs.

## Architecture

### Data hooks (`apps/web/src/hooks/use-tasks.ts`)

```ts
export type Task = {
	id: string;
	projectId: string;
	parentId: string | null;
	name: string;
	description: string | null;
	statusId: string;
	priority: string;
	progress: number;
	startDate: string | null; // ISO YYYY-MM-DD
	endDate: string | null;
	color: string | null;
	assigneeId: string | null;
	position: number;
	createdAt: string;
	updatedAt: string;
};

export type Milestone = {
	id: string;
	projectId: string;
	name: string;
	description: string | null;
	date: string; // ISO YYYY-MM-DD
	color: string | null;
	position: number;
	completedAt: string | null;
};

export const taskKeys = {
	list: (projectId: string) => ["tasks", "list", projectId] as const,
};
export const milestoneKeys = {
	list: (projectId: string) => ["milestones", "list", projectId] as const,
};
```

- `useProjectTasks(projectId)` → `GET /projects/:projectId/tasks`, `enabled: !!projectId`.
- `useProjectMilestones(projectId)` → `GET /projects/:projectId/milestones`, `enabled: !!projectId`.

### Mapping (`apps/web/src/components/timeline/data/map-items.ts`)

Pure functions (unit-tested), kept out of the provider. One entry point maps a project's tasks + milestones into the three render inputs:

```ts
type UndatedTaskRow = { id: string; name: string; parentId: string | null };
type MilestoneMarker = { id: string; date: string; name: string; color: string };

mapProjectData(tasks: Task[], milestones: Milestone[]): {
	datedItems: TimelineItem[];      // tasks with at least one date → bars
	undatedTaskRows: UndatedTaskRow[]; // tasks with no dates → empty-lane rows
	milestoneMarkers: MilestoneMarker[];
}
```

Rules:
- A task is **dated** if `startDate` or `endDate` is non-null. Dated → `TimelineItem` with `kind: "task"`, `parentId`, `name`, `progress`, `color: task.color ?? DEFAULT_TASK_COLOR`, and `startDate = task.startDate ?? task.endDate`, `endDate = task.endDate ?? task.startDate` (both guaranteed non-null, satisfying `TimelineItem`'s contract).
- A task with **both** dates null → an `UndatedTaskRow` (no bar; the layout renders an empty lane keyed by id).
- Each milestone → a `MilestoneMarker` at its `date`, `color: m.color ?? DEFAULT_TASK_COLOR`.

`DEFAULT_TASK_COLOR` is a shared constant.

### Provider (`apps/web/src/components/timeline/data/context.tsx`)

`TimelineDataProvider({ projectId?, seed?, children })`:

- If `projectId`: calls `useProjectTasks`/`useProjectMilestones`, maps results, seeds local `useState<TimelineItem[]>` via `useEffect` when data first loads (so local drag edits persist across re-renders but reset on refetch).
- If no `projectId`: seeds from the static `timelineItems` (default), preserving `/timeline` behavior.
- Exposes `useTimelineData()` → `{ items, updateItem, moveDays, undatedTaskRows, milestoneMarkers, isLoading, isError }`. `updateItem`/`moveDays` keep today's signatures.

`ItemsLayer` and `TimelineTable` switch their import from `useTimelineItems` to `useTimelineData`. `useTimelineItems` is removed (its `shiftDates`/`moveDays` logic moves into the provider).

### Rendering

1. **Tasks as rows** — unchanged `layoutItems` over `items` (dated tasks). Existing drag/resize works against the provider's local state.
2. **Undated tasks** — rendered as rows with an empty lane. A new gesture in `use-bar-interaction` (`create` role): pointer-down on an empty lane → drag to define a range → on commit, `updateItem(id, { startDate, endDate })` (local). Until created, the row shows a faint "click to schedule" affordance.
3. **Milestone axis markers** — a new `MilestoneMarkers` layer absolutely positioned over the timeline region; each marker a small diamond at `msToPercent(milestone.date)` with a tooltip showing the name. Rendered in the body's pinned background band (same coordinate space as `TimelineGrid`).

### Routes

- `routes/_workspace/$orgSlug/projects/$projectId.tsx`: read `projectId` from params; render `<TimelineDataProvider projectId={projectId}><TimelineView /></TimelineDataProvider>`.
- `routes/_workspace/$orgSlug/timeline.tsx`: render `<TimelineDataProvider><TimelineView /></TimelineDataProvider>` (seed).
- `TimelineView` no longer hard-codes a data source; the route owns the provider. `SplitLayout` already wraps `TimelineProvider`/`RowSelectionProvider`; `TimelineDataProvider` wraps outside `TimelineView` so the table + items layer share it.

## Data flow

```
project route (projectId)
  └─ TimelineDataProvider
       ├─ useProjectTasks(projectId)  ── GET /projects/:id/tasks ─┐
       ├─ useProjectMilestones(projectId) ── GET /…/milestones ───┤
       │                                                          ▼
       │                                  map → items[] + undatedRows + milestoneMarkers
       │                                  (seed local state)
       └─ TimelineView
            ├─ TimelineTable   ── useTimelineData() → rows
            ├─ ItemsLayer      ── useTimelineData() → bars + empty lanes (click-create)
            └─ MilestoneMarkers── useTimelineData() → axis diamonds
```

## Error / empty / loading

- Axis + grid always render.
- Loading → empty lanes, no content flash.
- Error → a muted inline message in the items area ("Couldn't load tasks").
- Empty project → grid with a centered "No tasks yet" hint.

## Testing

Vitest + Testing Library:
- `map-items.test.ts` — task→item mapping (dated/undated split, color fallback, parentId), milestone→marker, progress/kind.
- `use-tasks.test.tsx` — `useProjectTasks`/`useProjectMilestones` call the right endpoints, keyed by projectId, disabled without one.
- `context.test.tsx` — provider seeds from query data when `projectId` given; seeds from static seed when not; `updateItem`/`moveDays` mutate local state; loading/error flags surface.
- `milestone-markers.test.tsx` — renders a diamond per milestone at the right position; tooltip shows name.
- Extend `use-bar-interaction` tests for the `create` gesture (empty-lane drag → range).

## Out of scope

- Persisting drag/resize/create (the write slice: PATCH /tasks/:id, /tasks/:id/move).
- `assignee` and `status` rendering (need members/status lookups).
- Reparenting/reordering tasks via the timeline.
- Creating tasks/milestones from the timeline (only dating existing undated tasks).
- The `/timeline` (non-project) route showing real data — stays seed.
