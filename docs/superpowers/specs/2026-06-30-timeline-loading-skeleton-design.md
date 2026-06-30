# Timeline Loading Skeleton — Design

**Date:** 2026-06-30
**Scope:** Show a full skeleton screen in place of the project timeline while that project's tasks/milestones are loading. Frontend only.

## Goal

Replace the bare-grid flash shown today during a project's initial data load with a full skeleton that mimics the timeline's split layout, so the loading state reads intentionally.

## Background

`TimelineView` currently gates between an empty state and the timeline:

```ts
const isEmptyProject =
	!!projectId && !isLoading && !isError &&
	items.length === 0 && undatedTaskRows.length === 0;
```

While `isLoading` is true, `isEmptyProject` is false, so the timeline (`SplitLayout`) renders with no bars — a bare grid. We add a loading branch that takes precedence.

## Decisions

- **Replace-the-view, gate order `loading → empty → timeline`:** in `TimelineView`, when `!!projectId && isLoading`, render `<TimelineSkeleton />`; else apply the existing empty/timeline gate. Loading is checked first because `items` is empty during load and would otherwise (incorrectly) trip neither branch into the bare grid.
- **Full skeleton mimicking the split layout:** a left table column of placeholder rows + a right "bar area" with one shimmer bar per row at varied widths/offsets. No real axis or data.
- **Seed mode unaffected:** `/timeline` (no `projectId`) has `isLoading === false` from the provider, so the skeleton never shows there.
- **Static fixed row count** (7) — no need to match real data.
- **Accessibility:** the skeleton container is `aria-busy` with an `sr-only` "Loading tasks" label.
- **Conventions:** `Skeleton` from `@orbit/ui/components/skeleton`; `cn()` from `@orbit/shared`; Biome tabs; no `any`.

## Architecture

### `components/timeline/timeline-skeleton.tsx` (new)

`TimelineSkeleton()` (default export, no props):

- Root: `<div className="h-full" aria-busy="true">` with an `sr-only` "Loading tasks" (e.g. a visually-hidden span).
- Renders a fixed list of ~7 rows. Each row is a flex line at `ROW_HEIGHT` (from `layout/row-metrics`) so spacing matches the real timeline:
  - **Left cell** (table-column width region): a `Skeleton` line for the task name (plus a small circle `Skeleton` for the color dot to echo the real row).
  - **Right area**: a `Skeleton` "bar" (rounded, `h-5`) with per-row varied `width`/`marginLeft` from a static array (e.g. `[{ off: 8, w: 30 }, { off: 24, w: 45 }, …]` as percentages) so it reads as a staggered Gantt.
- Pure presentational; the shimmer comes from `Skeleton`. No timers, no data.

### `components/timeline/timeline-view.tsx` (edit)

Read `isLoading` (already on the `useTimelineData()` value) and add the loading branch:

```tsx
const { projectId, items, undatedTaskRows, isLoading, isError } = useTimelineData();
const isLoadingProject = !!projectId && isLoading;
const isEmptyProject =
	!!projectId && !isLoading && !isError &&
	items.length === 0 && undatedTaskRows.length === 0;

return (
	<div className="h-full">
		{isLoadingProject ? (
			<TimelineSkeleton />
		) : isEmptyProject ? (
			<TimelineEmptyState projectId={projectId} />
		) : (
			<SplitLayout tableHeader={<TimelineTableHeader />} table={<TimelineTable />} />
		)}
	</div>
);
```

## Data flow

```
project route → TimelineDataProvider → useTimelineData() { isLoading, ... }
  └─ TimelineView
       ├─ isLoadingProject  → TimelineSkeleton
       ├─ isEmptyProject    → TimelineEmptyState
       └─ else              → SplitLayout (timeline)
```

When the queries resolve, `isLoading` flips false → the gate re-evaluates to empty state or the timeline.

## Error / empty / loading interplay

- Loading (`projectId && isLoading`) → skeleton.
- Error (`isError`, not loading) → existing inline error overlay on the timeline (unchanged; `isLoadingProject` is false, `isEmptyProject` is false because `isError` guards it, so `SplitLayout` renders with its error overlay).
- Empty (loaded, zero tasks) → empty state.
- Seed mode → always the timeline.

## Testing

Vitest + Testing Library:
- `timeline-skeleton.test.tsx` — renders the expected number of skeleton rows; container has `aria-busy="true"`; exposes the "Loading tasks" accessible label.
- `timeline-view.test.tsx` (edit) — update the existing "while loading" case: `projectId` set + `isLoading: true` now renders the **skeleton** (assert skeleton sentinel present; `split-layout` and `empty-state` absent). Keep the has-tasks, seed-mode, and zero-task (empty) cases. Mock `./timeline-skeleton` alongside the existing mocks.

## Out of scope

- Loading treatment for the seed `/timeline` route (never loads).
- Per-row / progressive loading or matching the real row count.
- Changes to the error state (keeps the inline overlay).
- A loading state for the create-task mutation (the dialog already has its own pending state).
