# Project Timeline — Empty State + Full-Height Table — Design

**Date:** 2026-06-30
**Scope:** When a project has no tasks, replace the timeline with a centered empty-state screen offering a "Create task" action (opens a create-task dialog → `POST /projects/:id/tasks`). When tasks exist but are fewer than the viewport, the left table column fills the full visible height instead of collapsing. Frontend only.

## Goal

Make an empty project's timeline actionable (create the first task) instead of showing a bare grid, and stop the table column from collapsing to a thin strip when there are few rows.

## Decisions

- **Zero-tasks view (project route only):** when `projectId` is set and `!isLoading && !isError && items.length === 0 && undatedTaskRows.length === 0`, render a standalone `TimelineEmptyState` instead of the timeline (`SplitLayout`). The empty state replaces the axis/grid/table/scrollbar entirely.
- **Create task:** the empty state's button opens a `CreateTaskDialog` (`@tanstack/react-form`) with **name (required)** + **optional start/end dates**; submits via a new `useCreateTask(projectId)` → `POST /projects/:projectId/tasks`, invalidating `taskKeys.list(projectId)`. On success the dialog closes and the list refetch flips the view from empty state to the populated timeline.
- **Full-height table:** when tasks exist, the scroll body's row + table column get `min-h-full` so the table column background fills the visible height even when stacked rows are short (plain background fill — no ghost/striped rows).
- **Seed mode (`/timeline`) unaffected:** it always has seed items, so the empty-state gate never triggers and there is no `projectId` to create against.
- **Loading/error:** loading renders the timeline (empty grid, no flash) — the gate excludes `isLoading`; error keeps the existing inline error overlay — the gate excludes `isError`.
- **Conventions:** TanStack Query mutation mirrors `useCreateProject`; dialog mirrors `CreateProjectDialog`; `@orbit/ui` + `cn()`; Biome tabs; `@tanstack/react-form` only.

## Architecture

### `hooks/use-tasks.ts` (extend)

Add a mutation alongside the existing query hooks:

- `useCreateTask(projectId: string)` — `useMutation` posting `CreateTaskInput` (from `@orbit/shared`) to `/projects/${projectId}/tasks`; `onSuccess` invalidates `taskKeys.list(projectId)` and toasts success; `onError` toasts `getErrorMessage(err, "Couldn't create task")`. Returns the created `Task`.

### `components/timeline/data/context.tsx` (edit)

Expose `projectId` on the context value so consumers can tell project mode from seed mode and target creation:

- `TimelineDataValue` gains `projectId: string | undefined`.
- The provider passes its `projectId` prop through (added to the memoized value + dep array).

### `components/timeline/create-task-dialog.tsx` (new)

`CreateTaskDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void })`:

- `Dialog` from `@orbit/ui`; `@tanstack/react-form` with `defaultValues: { name: "", startDate: "", endDate: "" }`.
- `name`: required (onChange/onBlur validator, "Name is required", same honest-validation pattern as `CreateProjectDialog`). `startDate`/`endDate`: optional `<input type="date">` via `@orbit/ui` Input.
- Submit → `useCreateTask(projectId).mutateAsync({ name, startDate?, endDate? })` (omit empty date strings). On success `onOpenChange(false)` + `form.reset()`. Submit disabled while pending.

### `components/timeline/timeline-empty-state.tsx` (new)

`TimelineEmptyState({ projectId }: { projectId: string })`:

- Full-height centered card: an icon, a heading ("No tasks yet"), a short line ("Create your first task to start planning."), and a primary **Create task** `Button`.
- Local `useState` `dialogOpen`; the button opens `<CreateTaskDialog projectId={projectId} open={dialogOpen} onOpenChange={setDialogOpen} />`.
- Container fills its parent (`flex h-full items-center justify-center`).

### `components/timeline/timeline-view.tsx` (edit)

Gate the render:

```tsx
const { projectId, items, undatedTaskRows, isLoading, isError } = useTimelineData();
const isEmptyProject =
	!!projectId && !isLoading && !isError &&
	items.length === 0 && undatedTaskRows.length === 0;
return (
	<div className="h-full">
		{isEmptyProject ? (
			<TimelineEmptyState projectId={projectId} />
		) : (
			<SplitLayout tableHeader={<TimelineTableHeader />} table={<TimelineTable />} />
		)}
	</div>
);
```

(`TimelineView` already lives inside `TimelineDataProvider`, so `useTimelineData()` resolves.)

### `components/timeline/layout/split-layout.tsx` (edit)

The scroll body currently has `<div className="absolute inset-0 overflow-y-auto …"><div className="flex">…</div></div>` with a `shrink-0` table-column div sized by its child's `contentHeight`. Add `min-h-full` to the inner `flex` row and to the table-column div so the column's `bg-background-primary` fills the visible height when rows are short. Rows still position from the top; the area below the last row shows the column background. With many rows, content exceeds the viewport and scrolls as before.

### `components/timeline/items-layer.tsx` (edit)

Remove the `timeline-items-empty` overlay block (added in the prior slice) — the empty-state screen now supersedes it for the project route, and seed mode never reaches zero items. Keep the `timeline-items-error` overlay and the `timeline-items-unscheduled` note.

## Data flow

```
project route (projectId) → TimelineDataProvider → useTimelineData() exposes projectId + items + flags
  └─ TimelineView
       ├─ isEmptyProject → TimelineEmptyState(projectId)
       │     └─ Create task → CreateTaskDialog → useCreateTask(projectId)
       │           └─ POST /projects/:id/tasks → invalidate taskKeys.list → items refetch → gate flips → timeline renders
       └─ else → SplitLayout (table column min-h-full)
```

## Error / empty / loading

- Empty project: `TimelineEmptyState` (gate above).
- Loading: timeline renders (gate excludes `isLoading`); no empty flash.
- Query error: timeline renders with the existing `timeline-items-error` overlay (gate excludes `isError`).
- Create mutation error: error toast (`getErrorMessage`); dialog stays open.

## Testing

Vitest + Testing Library:
- `use-tasks.test.tsx` — `useCreateTask` posts to `/projects/:id/tasks` and invalidates `taskKeys.list(projectId)`.
- `create-task-dialog.test.tsx` — empty name blocks submit (honest validation, mutation not called); valid submit calls `mutateAsync({ name })` and closes; dates included when provided.
- `timeline-empty-state.test.tsx` — renders heading + button; clicking the button opens the dialog.
- `timeline-view.test.tsx` — with `projectId` + zero items (not loading/error) renders the empty state; with items renders `SplitLayout`; seed mode (no projectId) renders `SplitLayout`. (Mock `useTimelineData`.)
- `context.test.tsx` — extend: `projectId` is exposed on the value (set in project mode, undefined in seed mode).
- Existing `split-layout`/`items-layer` tests stay green (the `min-h-full` change and the removed empty overlay must not break them).

## Out of scope

- Editing/deleting tasks; assignee/status/labels in the create dialog (name + dates only).
- Click-to-create on empty lanes (separate deferred slice).
- Persisting drag/resize (separate deferred slice).
- An error-state screen replacing the timeline (errors keep the inline overlay).
