# Gantt Task Dependencies — Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)

## Summary

Add task-to-task dependency links to the timeline/Gantt view. Each task bar
exposes two connection nodes (start + finish). Dragging from a node on one task
to a node on another creates a dependency, drawn as a right-angle (elbow)
connector with an arrowhead. Dependencies are persisted (full stack: DB → API →
UI) and support all four dependency types (FS, SS, FF, SF).

This is the first pass on Gantt dependencies. The focus is the drag-to-create
UI, backed by real persistence.

## Decisions (from brainstorming)

- **Persistence:** full stack now — DB table, API endpoints, optimistic UI. Not
  local-only.
- **Dependency semantics:** all four types (FS, SS, FF, SF).
- **Node visibility:** connection nodes appear on bar hover (or while a link
  drag is active), not always — the timeline routinely holds thousands of bars.
- **Link style:** elbow / right-angle connector with rounded corners and an
  arrowhead at the target.
- **Delete:** hovering a committed link reveals a small ✕ at its midpoint to
  delete it.

## Out of scope (future work)

- **Cycle detection.** Creating dependencies that form a cycle is not prevented
  in this pass. Validation is limited to: same project/org, no self-link, no
  duplicate edge.
- **Scheduling/auto-shift.** Dependencies do not (yet) constrain or move dates.
  They are visual + stored relationships only.
- **Editing a link's type** after creation (delete + recreate instead).

## Data model (API)

New table `task_dependency` in `apps/api/src/db/schema/projects.ts`:

| column          | type / notes                                             |
| --------------- | -------------------------------------------------------- |
| `id`            | `text` PK (`randomUUID`)                                 |
| `projectId`     | `text` → `project.id`, `onDelete: cascade`               |
| `predecessorId` | `text` → `task.id`, `onDelete: cascade` (drag **from**)  |
| `successorId`   | `text` → `task.id`, `onDelete: cascade` (drag **to**)    |
| `type`          | `text` — `FS` \| `SS` \| `FF` \| `SF`, default `FS`      |
| `createdBy`     | `uuid` → `user.id`                                       |
| `createdAt`     | `timestamp` `defaultNow()`                               |

- The two-letter `type` encodes both anchors (F = finish, S = start): the first
  letter is the predecessor's anchor, the second is the successor's. So
  `(predecessorId, successorId, type)` fully captures all four kinds — no
  separate anchor columns.
- Unique index on `(predecessorId, successorId, type)` prevents duplicate edges.
- Drizzle relations added for typed `.query` access where useful.
- Migration generated via `pnpm db:generate`, applied with `pnpm db:migrate`.

## Shared schema (`@orbit/shared`)

New `packages/shared/src/schemas/dependencies.ts`, exported from `index.ts`:

```ts
export const DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const createDependencySchema = z.object({
  predecessorId: z.string(),
  successorId: z.string(),
  type: z.enum(DEPENDENCY_TYPES).default("FS"),
});
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
```

## API module (`apps/api/src/projects/dependencies/`)

`dependencies.service.ts` + `dependencies.controller.ts`, registered in
`projects.module.ts` (both `controllers` and `providers`). Follows the existing
tasks pattern: `@UseGuards(AuthGuard)`, `orgId` derived from `@CurrentSession()`,
Zod `.parse()` on the body.

Endpoints:

- `GET    projects/:projectId/dependencies` → list for a project
- `POST   projects/:projectId/dependencies` → create
- `DELETE dependencies/:id` → remove

Service validation on create:

- `assertProjectInOrg(projectId, orgId)` (reuse `ProjectsService`).
- Both `predecessorId` and `successorId` are tasks in `projectId`.
- `predecessorId !== successorId` (no self-link) → `BadRequestException`.
- No existing row with the same `(predecessorId, successorId, type)` →
  `ConflictException`.

## Web data layer

`apps/web/src/hooks/use-dependencies.ts`:

- `Dependency` type mirrors the row.
- `dependencyKeys.list(projectId)`.
- `useProjectDependencies(projectId)` — GET, `enabled: !!projectId`.
- `useCreateDependency(projectId)` — POST with optimistic add (temp id),
  reconcile on success, roll back + toast on error.
- `useDeleteDependency(projectId)` — DELETE with optimistic remove, roll back on
  error.

Exposed through `TimelineDataContext` alongside `items`:
`dependencies`, `createDependency`, `deleteDependency`.

## Timeline UI

### Connection nodes

Rendered per task bar in `items-layer.tsx`: two small circles at the left
(start) and right (finish) edges, vertical-center. Hidden unless the bar is
hovered (`hoveredId === item.id`) or a link drag is active. Each node:

- `pointer-events-auto`
- `data-link-target={taskId}`, `data-link-anchor={"start" | "finish"}`
- `onPointerDown` → `beginLink(e, { fromTaskId, fromAnchor })` and
  `e.stopPropagation()` so it never triggers the bar's move/resize gesture.

### `use-link-interaction.ts`

Mirrors `use-bar-interaction.ts` (window `pointermove`/`pointerup` listeners +
pointer capture, single active gesture guard). State:

- `linkDraft: { fromTaskId: string; fromAnchor: Anchor; pointer: {x,y} } | null`

On `pointerup`, hit-test with `document.elementFromPoint(x, y)` →
`.closest("[data-link-target]")`. If it resolves to a **different** task, fire
`createDependency({ predecessorId: fromTaskId, successorId: targetId, type:
anchorCode(fromAnchor) + anchorCode(toAnchor) })`. Otherwise cancel. Always
clean up listeners + release capture.

### `dependencies/geometry.ts` (pure, unit-tested)

- `anchorPoint(row, anchor, geom, getPercentageOffset)` → `{ xPercent, y }`
  where `y = rowTop(rowIndex) + barHeight/2` and `xPercent` is the start or
  finish edge of the (possibly draft) range.
- `elbowPath(from, to)` → SVG path string: horizontal stub out of the source,
  vertical run to the target row, horizontal into the target, with rounded
  corners. Arrowhead drawn via an SVG `<marker>` at the target end.

### `DependencyLayer` (`dependencies/dependency-layer.tsx`)

An absolutely-positioned SVG overlay filling the ItemsLayer content box.

- Builds a `taskId → { rowIndex, range }` map from the laid-out `rows`, applying
  live `draft` ranges so links follow bars during move/resize.
- Draws each committed dependency as an elbow path. Renders a link only if its
  row span intersects the visible window — reuses
  `useVirtualRows().isSpanVisible(min, max)`.
- Draws the in-progress **ghost elbow** from the source anchor to the current
  pointer while `linkDraft` is set.
- Hovering a committed link reveals a small ✕ button at the path midpoint →
  `deleteDependency(id)`. The stroke uses `pointer-events-auto` for hit area;
  the rest of the SVG is `pointer-events-none`.

## Testing

**API (Jest)** — `dependencies.service.spec.ts`:

- create: succeeds for two tasks in the project; rejects self-link; rejects
  duplicate `(pred, succ, type)`; rejects task from another project.
- list returns a project's dependencies.
- remove deletes a row.

**Web (Vitest)**:

- `geometry.test.ts` — `anchorPoint` returns start vs finish edge correctly;
  `elbowPath` produces the expected segments for same-row and cross-row cases.
- `items-layer` — connection nodes are hidden by default and appear on hover;
  `DependencyLayer` renders one path per dependency for provided deps.
- link hit-test resolves the target task id + anchor from a node element.

## New / changed files

**API**
- `apps/api/src/db/schema/projects.ts` — `taskDependency` table + relations
- generated migration under `apps/api/src/db/migrations/`
- `apps/api/src/projects/dependencies/dependencies.service.ts` (+ `.spec.ts`)
- `apps/api/src/projects/dependencies/dependencies.controller.ts`
- `apps/api/src/projects/projects.module.ts` — register module pieces

**Shared**
- `packages/shared/src/schemas/dependencies.ts` (+ `index.ts` export)

**Web**
- `apps/web/src/hooks/use-dependencies.ts`
- `apps/web/src/components/timeline/dependencies/geometry.ts` (+ `geometry.test.ts`)
- `apps/web/src/components/timeline/dependencies/dependency-layer.tsx`
- `apps/web/src/components/timeline/use-link-interaction.ts`
- `apps/web/src/components/timeline/data/context.tsx` — expose deps + mutations
- `apps/web/src/components/timeline/items-layer.tsx` — nodes, link gesture, layer
