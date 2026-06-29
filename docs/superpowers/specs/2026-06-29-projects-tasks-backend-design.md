# Projects & Tasks — Backend Design

**Date:** 2026-06-29
**Scope:** Database schema + migration, shared Zod schemas/constants, and a NestJS module with CRUD endpoints (projects, tasks, milestones, customizable statuses, customizable labels). No frontend wiring in this pass.

## Goal

Introduce server-side persistence for **projects** and **tasks**, with customizable **statuses** and **labels**, so the timeline feature can eventually replace its static seed data (`apps/web/src/data/timeline-items.ts`). This pass delivers the data model and API surface only.

## Decisions

- **Hierarchy:** Org → Project → Task. A task belongs to exactly one project and may self-reference a `parentId` for subtask/grouping nesting.
- **Milestones are a separate entity**, not a task kind. A milestone belongs to exactly one project and is a single dated marker (no duration, no progress, no subtasks). The timeline view will merge tasks and milestones for rendering in a later (frontend) pass.
- **Project ↔ Team:** many-to-many via a `project_team` join table. One project links to many teams; teams remain reusable org-level entities (no unique constraint on `teamId`).
- **Assignment:** single nullable `assigneeId` per task.
- **Statuses (Linear-style):** status **types** are fixed, **site-wide code constants** (identical for every org); the named **states** inside each type are **org-wide** rows that users create, rename, recolor, reorder, and delete.
  - Task status types: `backlog`, `planned`, `in_progress`, `done`, `canceled`.
  - Project status types: `draft`, `planning`, `execution`, `monitoring`, `completed`.
- **Priority:** fixed enum on `task`: `none` | `low` | `medium` | `high` | `urgent` (text column, default `none`).
- **Labels:** org-wide, user-managed (add/rename/delete). **Separate sets** for projects vs tasks. Many-to-many via join tables. Attach via **replace-all** `labelIds` on the task/project create/update payloads.
- **Status deletion requires migration:** deleting a status that is still referenced returns 409 unless the request supplies `reassignTo` (another status id in the same org), in which case all referencing rows are moved to that status first, then the status is deleted.
- **Authorization:** org-scoped only. Any authenticated member of the active organization may CRUD any project/task/status/label within that org. Creator/role restrictions are deferred to a later pass.
- **Validation:** Zod schemas + constants in `@orbit/shared`, validated inline in controllers via `schema.parse(body)` with `@Body() body: unknown` — matching `preferences.controller.ts`. No `*.dto.ts` files, no custom pipe, no new `zod` dependency in `apps/api`.

## Shared constants & schemas (`@orbit/shared`)

New files, re-exported from `packages/shared/src/schemas/index.ts` and the package barrel:

- `schemas/projects.ts` — project constants + schemas:
  - `PROJECT_STATUS_TYPES = ["draft","planning","execution","monitoring","completed"]` + `ProjectStatusType` type
  - `createProjectSchema` (`name`, `description?`, `statusId?`, `color?`, `startDate?`, `endDate?`, `teamIds?`, `labelIds?`)
  - `updateProjectSchema` (partial), `setProjectTeamsSchema` (`{ teamIds: string[] }`)
- `schemas/tasks.ts`:
  - `TASK_STATUS_TYPES = ["backlog","planned","in_progress","done","canceled"]` + `TaskStatusType` type
  - `TASK_PRIORITIES = ["none","low","medium","high","urgent"]` + `TaskPriority` type
  - `createTaskSchema` (`name`, `parentId?`, `description?`, `statusId?`, `priority?`, `progress?`, `startDate?`, `endDate?`, `color?`, `assigneeId?`, `position?`, `labelIds?`)
  - `updateTaskSchema` (partial), `moveTaskSchema` (`{ parentId?: string | null, position: number }`)
- `schemas/milestones.ts`:
  - `createMilestoneSchema` (`name`, `date`, `description?`, `color?`, `position?`)
  - `updateMilestoneSchema` (partial; adds `completedAt?: string | null` to mark reached/unreached)
- `schemas/taxonomy.ts` (statuses + labels):
  - `createTaskStatusSchema` (`type` ∈ task status types, `name`, `color?`, `position?`), `updateTaskStatusSchema` (partial; `type` updatable)
  - `createProjectStatusSchema` (`type` ∈ project status types, `name`, `color?`, `position?`), `updateProjectStatusSchema`
  - `createLabelSchema` (`name`, `color?`), `updateLabelSchema` (partial) — reused for task & project labels
  - `deleteStatusSchema` (`{ reassignTo?: string }`)

Enum membership, `0 <= progress <= 100`, and required fields are enforced here.

## Database schema

New file `apps/api/src/db/schema/projects.ts`, re-exported from `apps/api/src/db/schema/index.ts`. Conventions follow `chat.ts`: `text` primary keys via `randomUUID()`, `uuid` FKs to `organization`/`user`/`team` with cascade, inline Drizzle relations. `type`/`priority` stored as plain `text` (enforced in Zod, not `pgEnum`).

### Taxonomy tables (org-wide)

**`task_status`**

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | uuid NOT NULL | → `organization.id` cascade |
| `type` | text NOT NULL | one of the task status types (constant) |
| `name` | text NOT NULL | |
| `color` | text | nullable |
| `position` | integer NOT NULL default `0` | order within type |
| `createdAt` | timestamp NOT NULL | `defaultNow()` |

**`project_status`** — same shape, `type` ∈ project status types.

**`task_label`** / **`project_label`**

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | uuid NOT NULL | → `organization.id` cascade |
| `name` | text NOT NULL | |
| `color` | text | nullable |
| `createdAt` | timestamp NOT NULL | `defaultNow()` |

**`task_label_link`** (join): `taskId` text → `task.id` cascade, `taskLabelId` text → `task_label.id` cascade, composite PK `(taskId, taskLabelId)`, `createdAt`.
**`project_label_link`** (join): `projectId` → `project.id` cascade, `projectLabelId` → `project_label.id` cascade, composite PK, `createdAt`.

### `project`

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | |
| `organizationId` | uuid NOT NULL | → `organization.id` cascade |
| `name` | text NOT NULL | |
| `description` | text | nullable |
| `statusId` | text NOT NULL | → `project_status.id` `onDelete: restrict` |
| `color` | text | nullable |
| `startDate` | date | nullable |
| `endDate` | date | nullable |
| `createdBy` | uuid NOT NULL | → `user.id` |
| `createdAt` / `updatedAt` | timestamp NOT NULL | `defaultNow()` |
| `archivedAt` | timestamp | nullable (archive is orthogonal to status) |

### `project_team` (many-to-many)

`projectId` text → `project.id` cascade, `teamId` uuid → `team.id` cascade, composite PK `(projectId, teamId)`, `createdAt`.

### `task`

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | |
| `projectId` | text NOT NULL | → `project.id` cascade |
| `parentId` | text | nullable, self-ref → `task.id` cascade |
| `name` | text NOT NULL | |
| `description` | text | nullable |
| `statusId` | text NOT NULL | → `task_status.id` `onDelete: restrict` |
| `priority` | text NOT NULL default `"none"` | fixed enum |
| `progress` | integer NOT NULL default `0` | 0–100 |
| `startDate` | date | nullable |
| `endDate` | date | nullable |
| `color` | text | nullable |
| `assigneeId` | uuid | nullable → `user.id` `onDelete: set null` |
| `position` | integer NOT NULL default `0` | order within parent; drives timeline row order |
| `createdBy` | uuid NOT NULL | → `user.id` |
| `createdAt` / `updatedAt` | timestamp NOT NULL | `defaultNow()` |

### `milestone`

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | |
| `projectId` | text NOT NULL | → `project.id` cascade |
| `name` | text NOT NULL | |
| `description` | text | nullable |
| `date` | date NOT NULL | the single milestone date |
| `color` | text | nullable |
| `position` | integer NOT NULL default `0` | order among the project's milestones |
| `completedAt` | timestamp | nullable (null = not reached) |
| `createdBy` | uuid NOT NULL | → `user.id` |
| `createdAt` / `updatedAt` | timestamp NOT NULL | `defaultNow()` |

No `parentId`, `status`, `priority`, `progress`, or labels — milestones are flat, project-scoped markers.

### Relations

- `project` → one `organization`, one `projectStatus`, many `task`, many `milestone`, many `projectTeam`, many `projectLabelLink`.
- `task` → one `project`, one `taskStatus`, self `parent`/`children`, one `assignee`, many `taskLabelLink`.
- `milestone` → one `project`.
- `taskStatus`/`projectStatus` → one `organization`, many tasks/projects.
- `taskLabel`/`projectLabel` → one `organization`, many link rows.
- `projectTeam` → one `project`, one `team`.

### Migration

Generate with `pnpm db:generate` (from `apps/api`), then `pnpm db:migrate`.

## Default seeding

`ensureOrgDefaults(orgId)` — idempotent helper that, if the org has no task/project statuses, inserts the default named states (one per type, name = humanized type):

- task: Backlog, Planned, In Progress, Done, Canceled
- project: Draft, Planning, Execution, Monitoring, Completed

Labels seed empty.

- **New orgs:** called from `afterCreateOrganization` (`apps/api/src/auth/organization-billing-hooks.ts`).
- **Existing dev orgs:** backfilled via `pnpm db:seed:dev`.
- **Safety net:** task/project create resolves a default `statusId` when omitted (first status by `position`; for tasks, in the `backlog` type), calling `ensureOrgDefaults` first if none exist.

## NestJS module

New `apps/api/src/projects/` module, registered in `app.module.ts`. Mirrors the `chat/channels` pattern: `@UseGuards(AuthGuard)`, `@CurrentUser()`/`@CurrentSession()`, org scoping via `session.activeOrganizationId` (throw `ForbiddenException` when absent), DB via injected `DB` token, `randomUUID()` ids.

```
apps/api/src/projects/
  projects.module.ts                       // imports AuthModule; added to app.module.ts
  org-defaults.ts                          // ensureOrgDefaults() helper (shared by hook + services)
  projects/projects.controller.ts + projects.service.ts
  tasks/tasks.controller.ts + tasks.service.ts
  milestones/milestones.controller.ts + milestones.service.ts
  statuses/statuses.controller.ts + statuses.service.ts   // task + project statuses
  labels/labels.controller.ts + labels.service.ts         // task + project labels
```

### Endpoints (all under `AuthGuard`, all org-scoped)

**Projects**

| method | path | purpose |
| --- | --- | --- |
| GET | `/projects` | list projects in active org |
| GET | `/projects/:id` | one project (+ status, teams, labels) |
| POST | `/projects` | create (+ optional `teamIds`, `labelIds`, `statusId`) |
| PATCH | `/projects/:id` | update fields incl. `statusId`, `labelIds` (replace-all) |
| DELETE | `/projects/:id` | delete (cascades tasks, project_team, label links) |
| PUT | `/projects/:id/teams` | replace-all linked team ids |

**Tasks**

| method | path | purpose |
| --- | --- | --- |
| GET | `/projects/:projectId/tasks` | list tasks (ordered by `position`) |
| POST | `/projects/:projectId/tasks` | create (+ `statusId`, `priority`, `parentId`, `labelIds`) |
| PATCH | `/tasks/:id` | update any field incl. `statusId`, `priority`, `labelIds` (replace-all) |
| DELETE | `/tasks/:id` | delete (cascades subtasks, label links) |
| PATCH | `/tasks/:id/move` | reorder/reparent (`parentId` + `position`) |

**Milestones**

| method | path | purpose |
| --- | --- | --- |
| GET | `/projects/:projectId/milestones` | list milestones (ordered by `date`, then `position`) |
| POST | `/projects/:projectId/milestones` | create milestone |
| PATCH | `/milestones/:id` | update (name, date, color, position, `completedAt`) |
| DELETE | `/milestones/:id` | delete |

**Statuses** (task & project)

| method | path | purpose |
| --- | --- | --- |
| GET | `/task-statuses` · `/project-statuses` | list org statuses (grouped by type) |
| POST | `/task-statuses` · `/project-statuses` | create a named state in a type |
| PATCH | `/task-statuses/:id` · `/project-statuses/:id` | rename/recolor/reorder/change type |
| DELETE | `/task-statuses/:id` · `/project-statuses/:id` | delete; body `{ reassignTo? }` — 409 if in use without `reassignTo`, else migrate then delete |

**Labels** (task & project)

| method | path | purpose |
| --- | --- | --- |
| GET | `/task-labels` · `/project-labels` | list org labels |
| POST | `/task-labels` · `/project-labels` | create label |
| PATCH | `/task-labels/:id` · `/project-labels/:id` | rename/recolor |
| DELETE | `/task-labels/:id` · `/project-labels/:id` | delete (link rows cascade; just detaches from items) |

### Authorization & scoping

- Every query filters by `organizationId = session.activeOrganizationId`.
- Task operations verify the parent project belongs to the active org (else `NotFoundException`); `statusId`/`labelIds`/`reassignTo` references are validated to belong to the same org.
- No creator/role checks this pass.

### Services

- `ProjectsService`: `listProjects`, `getProject` (+status/teams/labels), `createProject`, `updateProject`, `deleteProject`, `setTeams` (replace-all, txn), `setLabels` (replace-all, txn).
- `TasksService`: `listTasks`, `createTask`, `updateTask`, `deleteTask`, `moveTask`, `setLabels`; private `assertProjectInOrg`.
- `MilestonesService`: `listMilestones`, `createMilestone`, `updateMilestone`, `deleteMilestone`; reuses the same `assertProjectInOrg` guard.
- `StatusesService`: task & project status CRUD; `deleteStatus(id, orgId, reassignTo?)` enforces the migration rule in a transaction.
- `LabelsService`: task & project label CRUD.

## Testing

- `apps/api` Jest unit tests:
  - org scoping (cross-org access → not-found) across projects, tasks, milestones, statuses, labels
  - project/task/milestone create/update/delete happy paths; team & label replace-all
  - milestone scoping to project-in-org; `completedAt` toggle
  - task reorder/reparent; cascade deletes
  - status delete: 409 when in use without `reassignTo`; successful migrate-then-delete with `reassignTo`
  - `ensureOrgDefaults` idempotency (no duplicate seeds on repeat calls)
- `@orbit/shared` Zod tests: progress range, task/project status type membership, priority enum, required fields.

## Out of scope

- Frontend TanStack Query hooks and swapping the timeline's static seed (next pass).
- Role/permission restrictions on mutations.
- Multiple assignees per task.
- Real-time (WebSocket) project/task updates.
- List virtualization (revisit once real data volume exists).
