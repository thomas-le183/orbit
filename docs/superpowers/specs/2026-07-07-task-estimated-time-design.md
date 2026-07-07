# Task `estimatedTime` field + remove mock timeline data

**Date:** 2026-07-07
**Status:** Approved

## Goal

Make `estimatedTime` a real, persisted task field end-to-end (DB → API → shared
DTO → frontend), wire it through to the scheduler view, persist bar-resize
estimate edits via the API, and delete the hardcoded mock timeline data that the
scheduler currently depends on for `estimatedTime`.

## Background

The scheduler already consumes `estimatedTime` — it lives on the frontend
`TimelineItem` type and drives bar height (`lane-metrics.barHeight`) and the
bottom-edge resize gesture (`useEstimateResize`). But `estimatedTime` only
exists in the hardcoded `timelineItems` mock array. The real `Task` (DB `task`
table → API → shared DTO → frontend `Task` type) has no such column, so
`mapProjectData` never populates it for real projects, and the resize gesture's
`onCommit` only mutates local state — it never persists.

Two confirmed decisions:
- Estimate-resize edits **persist** to the backend via PATCH (like
  drag-to-schedule and reassign already do).
- The mock data is **removed entirely**, including the unlinked `/timeline`
  route that renders it.

## Changes

### Backend

1. **DB schema** — `apps/api/src/db/schema/projects.ts`, `task` table
   (~line 117): add `estimatedTime: integer("estimated_time")` (nullable,
   minutes). Run `pnpm db:generate` then `pnpm db:migrate` from `apps/api`.

2. **Shared DTO** — `packages/shared/src/schemas/tasks.ts`: add
   `estimatedTime: z.number().int().min(0).optional()` to `createTaskSchema`.
   `updateTaskSchema` inherits it via `.partial()`.

3. **API service** — `apps/api/src/projects/tasks/tasks.service.ts`
   `createTask` insert (~line 52): add `estimatedTime: input.estimatedTime`.
   `updateTask` already spreads validated `fields` into `.set(...)`, so PATCH
   flows automatically once the DTO includes the field.

### Frontend

4. **Task type** — `apps/web/src/hooks/use-tasks.ts`: add
   `estimatedTime: number | null` to the `Task` type.

5. **Mapping** — `apps/web/src/components/timeline/data/map-items.ts`
   (~line 41): set `estimatedTime: t.estimatedTime ?? undefined` on the dated
   `TimelineItem` produced from a `Task`.

6. **Persist resize** —
   - `apps/web/src/components/timeline/data/context.tsx`: add
     `setEstimate(id, estimatedTime)` to the context value, calling
     `updateTask.mutate({ id, input: { estimatedTime } })` (mirrors
     `scheduleTask`). Expose it through `TimelineDataValue`.
   - `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
     (~line 84): wire `useEstimateResize`'s `onCommit` to call both
     `updateItem(id, { estimatedTime })` (optimistic local) and
     `setEstimate(id, estimatedTime)` (persist).

### Remove mock data

7. **`apps/web/src/data/timeline-items.ts`**: delete the `timelineItems` array
   and the `assignees` const. **Keep** the type exports (`TimelineItem`,
   `TaskAssignee`, `TaskStatus`, `TimelineItemKind`) — ~10 modules import them.
   Delete `apps/web/src/data/timeline-items.test.ts` (it only tests the seed).

8. **context.tsx**: remove the `if (!projectId)` fallback branch that returned
   `timelineItems`. When there is no `projectId`, return empty `items`,
   `undatedTaskRows`, and `milestoneMarkers`. Keep the `projectId` prop optional.

9. **`/timeline` route** —
   `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx`: renders the provider
   with no `projectId` and is not linked in any navigation; it exists only to
   display the mock. Delete the route file and let the TanStack Router Vite
   plugin regenerate `routeTree.gen.ts` (never edit that file by hand). The real
   timeline lives at `/projects/$projectId`.

10. **Test fixtures**: `dependency-layer.test.tsx` and the provider tests that
    render `<TimelineDataProvider>` without a `projectId` currently rely on the
    mock. Replace those with small inline `TimelineItem` fixtures.

## Testing

- **API** (`apps/api`, Jest): add coverage that `createTask` and `updateTask`
  persist `estimatedTime`.
- **Web** (`apps/web`, Vitest):
  - `map-items.test.ts`: assert `estimatedTime` maps through from `Task`.
  - `context.test.tsx`: assert empty items/rows when no `projectId`.
  - Convert `dependency-layer.test.tsx` and any no-`projectId` provider tests to
    inline fixtures.

## Out of scope

- No UI to *enter* an estimate outside the scheduler resize gesture (e.g. a
  field in the create-task dialog). The field is created and updated via the
  existing resize gesture and the API; a dedicated input can be a follow-up.
- No changes to bar-height tuning constants in `lane-metrics.ts`.
