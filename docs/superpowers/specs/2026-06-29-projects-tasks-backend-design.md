# Projects & Tasks — Backend Design

**Date:** 2026-06-29
**Scope:** Database schema + migration, shared Zod schemas, and a NestJS module with CRUD endpoints. No frontend wiring in this pass.

## Goal

Introduce server-side persistence for **projects** and **tasks** so the timeline feature can eventually replace its static seed data (`apps/web/src/data/timeline-items.ts`). This pass delivers the data model and API surface only.

## Decisions

- **Hierarchy:** Org → Project → Task. A task belongs to exactly one project and may self-reference a `parentId` for subtask/grouping nesting.
- **Project ↔ Team:** many-to-many via a `project_team` join table. One project links to many teams; teams remain reusable org-level entities (not locked to a single project — no unique constraint on `teamId`).
- **Assignment:** single nullable `assigneeId` per task (matches the current timeline UI).
- **Authorization:** org-scoped only. Any authenticated member of the active organization may CRUD any project/task within that org. Creator/role restrictions are explicitly deferred to a later pass.
- **Validation:** Zod schemas in `@orbit/shared`, validated inline in controllers via `schema.parse(body)` with `@Body() body: unknown` — matching the existing `preferences.controller.ts` pattern. No `*.dto.ts` files, no custom pipe, no new `zod` dependency in `apps/api` (resolved transitively through `@orbit/shared`).
- **Enums as text:** `status` and `kind` are plain `text` columns with defaults (matching `chat.ts` conventions); allowed values are enforced at the Zod layer rather than via `pgEnum`.

## Database schema

New file `apps/api/src/db/schema/projects.ts`, re-exported from `apps/api/src/db/schema/index.ts`. Conventions follow `chat.ts`: `text` primary keys generated with `randomUUID()`, `uuid` foreign keys to `organization` / `user` / `team` with cascade, inline Drizzle relations.

### `project`

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | app-generated (`randomUUID()`) |
| `organizationId` | uuid NOT NULL | → `organization.id` `onDelete: cascade` |
| `name` | text NOT NULL | |
| `description` | text | nullable |
| `status` | text NOT NULL default `"active"` | `active` \| `completed` \| `archived` |
| `color` | text | nullable |
| `startDate` | date | nullable |
| `endDate` | date | nullable |
| `createdBy` | uuid NOT NULL | → `user.id` |
| `createdAt` | timestamp NOT NULL | `defaultNow()` |
| `updatedAt` | timestamp NOT NULL | `defaultNow()` |
| `archivedAt` | timestamp | nullable (soft-archive marker) |

### `project_team` (many-to-many)

| column | type | notes |
| --- | --- | --- |
| `projectId` | text NOT NULL | → `project.id` `onDelete: cascade` |
| `teamId` | uuid NOT NULL | → `team.id` `onDelete: cascade` |
| `createdAt` | timestamp NOT NULL | `defaultNow()` |

Composite primary key `(projectId, teamId)`.

### `task`

| column | type | notes |
| --- | --- | --- |
| `id` | text PK | app-generated |
| `projectId` | text NOT NULL | → `project.id` `onDelete: cascade` |
| `parentId` | text | nullable, self-ref → `task.id` `onDelete: cascade` |
| `kind` | text NOT NULL default `"task"` | `task` \| `milestone` |
| `name` | text NOT NULL | |
| `description` | text | nullable |
| `status` | text NOT NULL default `"todo"` | `todo` \| `in_progress` \| `in_review` \| `done` \| `blocked` |
| `progress` | integer NOT NULL default `0` | 0–100 |
| `startDate` | date | nullable (milestone: equals `endDate`) |
| `endDate` | date | nullable |
| `color` | text | nullable |
| `assigneeId` | uuid | nullable → `user.id` `onDelete: set null` |
| `position` | integer NOT NULL default `0` | stable ordering within parent; drives timeline row order |
| `createdBy` | uuid NOT NULL | → `user.id` |
| `createdAt` | timestamp NOT NULL | `defaultNow()` |
| `updatedAt` | timestamp NOT NULL | `defaultNow()` |

### Relations

- `project` → many `task`, many `projectTeam`; one `organization`.
- `task` → one `project`; self `parent` / `children`; one `assignee` (user).
- `projectTeam` → one `project`, one `team`.

### Migration

Generate with `pnpm db:generate` from `apps/api`, then `pnpm db:migrate`.

## Shared Zod schemas

New files in `@orbit/shared`:

- `packages/shared/src/schemas/projects.ts`
  - `createProjectSchema` — `name` (required), `description?`, `status?`, `color?`, `startDate?`, `endDate?`, `teamIds?` (uuid[])
  - `updateProjectSchema` — all project fields optional (partial)
  - `setProjectTeamsSchema` — `{ teamIds: string[] }`
- `packages/shared/src/schemas/tasks.ts`
  - `createTaskSchema` — `name` (required), `kind?`, `parentId?`, `description?`, `status?`, `progress?`, `startDate?`, `endDate?`, `color?`, `assigneeId?`, `position?`
  - `updateTaskSchema` — partial of create
  - `moveTaskSchema` — `{ parentId?: string | null, position: number }`

Each file exports the schemas plus inferred input types (`CreateProjectInput`, etc.); all are re-exported from `packages/shared/src/schemas/index.ts` and the package barrel `packages/shared/src/index.ts`.

Status/kind/progress constraints (enum membership, `0 <= progress <= 100`) live in these schemas.

## NestJS module

New `apps/api/src/projects/` module, registered in `app.module.ts`. Mirrors the `chat/channels` pattern: `@UseGuards(AuthGuard)`, `@CurrentUser()` / `@CurrentSession()` decorators, org scoping via `session.activeOrganizationId` (throw `ForbiddenException` when absent), DB via the injected `DB` token, `randomUUID()` ids.

```
apps/api/src/projects/
  projects.module.ts            // imports AuthModule; added to app.module.ts imports[]
  projects/projects.controller.ts
  projects/projects.service.ts
  tasks/tasks.controller.ts
  tasks/tasks.service.ts
```

### Endpoints (all under `AuthGuard`, all org-scoped)

**Projects**

| method | path | purpose |
| --- | --- | --- |
| GET | `/projects` | list projects in the active org |
| GET | `/projects/:id` | one project including linked teams |
| POST | `/projects` | create project (+ optional initial `teamIds`) |
| PATCH | `/projects/:id` | update name/description/status/color/dates |
| DELETE | `/projects/:id` | delete (cascades tasks + project_team) |
| PUT | `/projects/:id/teams` | replace-all the linked team ids |

**Tasks**

| method | path | purpose |
| --- | --- | --- |
| GET | `/projects/:projectId/tasks` | list tasks for a project, ordered by `position` |
| POST | `/projects/:projectId/tasks` | create task |
| PATCH | `/tasks/:id` | update any field (dates, status, progress, assignee, parentId, name…) |
| DELETE | `/tasks/:id` | delete (cascades subtasks) |
| PATCH | `/tasks/:id/move` | reorder/reparent (`parentId` + `position`) |

### Authorization & scoping

- Every project query filters by `organizationId = session.activeOrganizationId`.
- Every task operation first verifies the parent project belongs to the active org; otherwise `NotFoundException`.
- No creator/role checks in this pass — any org member may mutate. (Restriction layer deferred.)

### Services

- `ProjectsService`: `listProjects(orgId)`, `getProject(id, orgId)` (with teams), `createProject(orgId, userId, input)`, `updateProject(id, orgId, input)`, `deleteProject(id, orgId)`, `setTeams(id, orgId, teamIds)` (replace-all in a transaction).
- `TasksService`: `listTasks(projectId, orgId)`, `createTask(projectId, orgId, userId, input)`, `updateTask(id, orgId, input)`, `deleteTask(id, orgId)`, `moveTask(id, orgId, input)`. A private `assertProjectInOrg(projectId, orgId)` helper guards task access.

## Testing

- `apps/api` Jest unit tests for `ProjectsService` and `TasksService`: org scoping (cross-org access returns not-found), create/update/delete happy paths, team replace-all, task reorder/reparent, cascade behavior.
- Zod schema tests in `@orbit/shared` for boundary cases (progress range, status/kind enum membership, required fields).

## Out of scope

- Frontend TanStack Query hooks and swapping the timeline's static seed (next pass).
- Role/permission restrictions on mutations.
- Multiple assignees per task.
- Real-time updates (WebSocket gateway) for project/task changes.
- List virtualization (tracked separately; revisit once real data volume exists).
