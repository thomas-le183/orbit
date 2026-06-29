# Projects & Tasks Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side persistence for projects, tasks, milestones, customizable statuses, and labels, exposed through an org-scoped NestJS CRUD module.

**Architecture:** A new Drizzle schema file (`projects.ts`) defines all tables; shared Zod schemas/constants live in `@orbit/shared`; a new `apps/api/src/projects` NestJS module (sub-features: projects, tasks, milestones, statuses, labels) mirrors the existing `chat/channels` pattern — `AuthGuard`, `@CurrentUser`/`@CurrentSession`, org scoping via `session.activeOrganizationId`, inline `schema.parse(body)` validation, `randomUUID()` ids. Default statuses are seeded per org on creation.

**Tech Stack:** NestJS, Drizzle ORM (node-postgres), PostgreSQL, Zod, `class` decorators (NestJS), Jest (apps/api), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-06-29-projects-tasks-backend-design.md`

## Global Constraints

- Run all `pnpm` commands from the repo root unless a task says `cd apps/api`.
- TypeScript: `camelCase` vars/functions, `PascalCase` types. Avoid `any`.
- Formatting: Biome with **tabs** (match surrounding files). Run `pnpm check` before committing.
- DB access: Drizzle only, via the injected `DB` token (`type Db`). No raw SQL, no other ORM.
- Validation: Zod schemas from `@orbit/shared`, parsed inline in controllers. No `class-validator` DTOs for this module.
- IDs: `randomUUID()` from `node:crypto` for all `text` primary keys.
- `@orbit/shared` uses `NodeNext` module resolution — every relative import needs a `.js` extension.
- After editing `@orbit/shared`, rebuild it (`pnpm --filter @orbit/shared build`) so `apps/api` resolves the new exports.

## Testing strategy (read before starting)

This codebase has **no DB integration-test harness** — existing `apps/api` services (channels, messages, …) ship without service specs and are verified by typecheck/build. We follow that norm:

- **Pure logic** (`humanizeStatusType`, default-status builders, `pickDefaultStatusId`): TDD'd with the existing **Jest** runner in `apps/api` (Task 4).
- **Zod schemas:** verified by `pnpm typecheck` (their inferred types are consumed by controllers, so mismatches fail the build) plus the runtime assertions in Task 4's helper test. No new test runner is added to `packages/shared`.
- **DB-bound services/controllers:** verified via `pnpm typecheck`, `pnpm check` (Biome), `pnpm build`, and a clean `pnpm db:generate` / `pnpm db:migrate`. DB integration tests are a documented follow-up, out of scope here.

## File structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/schemas/projects.ts` | Project Zod schemas + `PROJECT_STATUS_TYPES` |
| `packages/shared/src/schemas/tasks.ts` | Task Zod schemas + `TASK_STATUS_TYPES`, `TASK_PRIORITIES` |
| `packages/shared/src/schemas/milestones.ts` | Milestone Zod schemas |
| `packages/shared/src/schemas/taxonomy.ts` | Status + label Zod schemas |
| `packages/shared/src/schemas/index.ts` | (modify) re-export the above |
| `packages/shared/src/index.ts` | (modify) re-export new symbols |
| `apps/api/src/db/schema/projects.ts` | All Drizzle tables + relations |
| `apps/api/src/db/schema/index.ts` | (modify) `export * from "./projects"` |
| `apps/api/src/projects/org-defaults.ts` | Seed helpers + `ensureOrgDefaults` |
| `apps/api/src/projects/org-defaults.spec.ts` | Jest tests for pure seed helpers |
| `apps/api/src/auth/organization-billing-hooks.ts` | (modify) call `ensureOrgDefaults` after org create |
| `apps/api/src/db/seed.ts` | (modify) register backfill init seed |
| `apps/api/src/db/seeds/init/org-status-defaults.ts` | Backfill helper for existing orgs |
| `apps/api/src/projects/statuses/statuses.{controller,service}.ts` | Task + project status CRUD |
| `apps/api/src/projects/labels/labels.{controller,service}.ts` | Task + project label CRUD |
| `apps/api/src/projects/milestones/milestones.{controller,service}.ts` | Milestone CRUD |
| `apps/api/src/projects/projects/projects.{controller,service}.ts` | Project CRUD + teams/labels |
| `apps/api/src/projects/tasks/tasks.{controller,service}.ts` | Task CRUD + move/labels |
| `apps/api/src/projects/projects.module.ts` | Wire controllers/services |
| `apps/api/src/app.module.ts` | (modify) register `ProjectsModule` |

---

### Task 1: Shared Zod schemas & constants

**Files:**
- Create: `packages/shared/src/schemas/projects.ts`
- Create: `packages/shared/src/schemas/tasks.ts`
- Create: `packages/shared/src/schemas/milestones.ts`
- Create: `packages/shared/src/schemas/taxonomy.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces (constants): `TASK_STATUS_TYPES`, `TaskStatusType`, `TASK_PRIORITIES`, `TaskPriority`, `PROJECT_STATUS_TYPES`, `ProjectStatusType`.
- Produces (schemas): `createProjectSchema`, `updateProjectSchema`, `setProjectTeamsSchema`, `createTaskSchema`, `updateTaskSchema`, `moveTaskSchema`, `createMilestoneSchema`, `updateMilestoneSchema`, `createTaskStatusSchema`, `updateTaskStatusSchema`, `createProjectStatusSchema`, `updateProjectStatusSchema`, `createLabelSchema`, `updateLabelSchema`, `deleteStatusSchema` — each with an inferred `*Input` type.

- [ ] **Step 1: Create `packages/shared/src/schemas/tasks.ts`**

```ts
import { z } from "zod";

export const TASK_STATUS_TYPES = [
	"backlog",
	"planned",
	"in_progress",
	"done",
	"canceled",
] as const;
export type TaskStatusType = (typeof TASK_STATUS_TYPES)[number];

export const TASK_PRIORITIES = [
	"none",
	"low",
	"medium",
	"high",
	"urgent",
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const createTaskSchema = z.object({
	name: z.string().min(1).max(500),
	parentId: z.string().optional(),
	description: z.string().max(5000).optional(),
	statusId: z.string().optional(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	progress: z.number().int().min(0).max(100).optional(),
	startDate: z.string().date().optional(),
	endDate: z.string().date().optional(),
	color: z.string().max(32).optional(),
	assigneeId: z.string().uuid().optional(),
	position: z.number().int().optional(),
	labelIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const moveTaskSchema = z.object({
	parentId: z.string().nullable().optional(),
	position: z.number().int(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
```

- [ ] **Step 2: Create `packages/shared/src/schemas/projects.ts`**

```ts
import { z } from "zod";

export const PROJECT_STATUS_TYPES = [
	"draft",
	"planning",
	"execution",
	"monitoring",
	"completed",
] as const;
export type ProjectStatusType = (typeof PROJECT_STATUS_TYPES)[number];

export const createProjectSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	statusId: z.string().optional(),
	color: z.string().max(32).optional(),
	startDate: z.string().date().optional(),
	endDate: z.string().date().optional(),
	teamIds: z.array(z.string()).optional(),
	labelIds: z.array(z.string()).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const setProjectTeamsSchema = z.object({
	teamIds: z.array(z.string()),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type SetProjectTeamsInput = z.infer<typeof setProjectTeamsSchema>;
```

- [ ] **Step 3: Create `packages/shared/src/schemas/milestones.ts`**

```ts
import { z } from "zod";

export const createMilestoneSchema = z.object({
	name: z.string().min(1).max(300),
	date: z.string().date(),
	description: z.string().max(2000).optional(),
	color: z.string().max(32).optional(),
	position: z.number().int().optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().extend({
	completedAt: z.string().datetime().nullable().optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
```

- [ ] **Step 4: Create `packages/shared/src/schemas/taxonomy.ts`**

```ts
import { z } from "zod";
import { PROJECT_STATUS_TYPES } from "./projects.js";
import { TASK_STATUS_TYPES } from "./tasks.js";

export const createTaskStatusSchema = z.object({
	type: z.enum(TASK_STATUS_TYPES),
	name: z.string().min(1).max(100),
	color: z.string().max(32).optional(),
	position: z.number().int().optional(),
});
export const updateTaskStatusSchema = createTaskStatusSchema.partial();

export const createProjectStatusSchema = z.object({
	type: z.enum(PROJECT_STATUS_TYPES),
	name: z.string().min(1).max(100),
	color: z.string().max(32).optional(),
	position: z.number().int().optional(),
});
export const updateProjectStatusSchema = createProjectStatusSchema.partial();

export const createLabelSchema = z.object({
	name: z.string().min(1).max(100),
	color: z.string().max(32).optional(),
});
export const updateLabelSchema = createLabelSchema.partial();

export const deleteStatusSchema = z.object({
	reassignTo: z.string().optional(),
});

export type CreateTaskStatusInput = z.infer<typeof createTaskStatusSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type CreateProjectStatusInput = z.infer<
	typeof createProjectStatusSchema
>;
export type UpdateProjectStatusInput = z.infer<
	typeof updateProjectStatusSchema
>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type DeleteStatusInput = z.infer<typeof deleteStatusSchema>;
```

- [ ] **Step 5: Append re-exports to `packages/shared/src/schemas/index.ts`**

Add at the end of the file:

```ts
export * from "./projects.js";
export * from "./tasks.js";
export * from "./milestones.js";
export * from "./taxonomy.js";
```

- [ ] **Step 6: Append re-exports to `packages/shared/src/index.ts`**

Add at the end of the file:

```ts
export * from "./schemas/projects.js";
export * from "./schemas/tasks.js";
export * from "./schemas/milestones.js";
export * from "./schemas/taxonomy.js";
```

- [ ] **Step 7: Build shared and typecheck**

Run: `pnpm --filter @orbit/shared build && pnpm --filter @orbit/shared typecheck`
Expected: both succeed, `packages/shared/dist` now contains `schemas/projects.js` etc.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): add project/task/milestone/taxonomy zod schemas"
```

---

### Task 2: Database schema

**Files:**
- Create: `apps/api/src/db/schema/projects.ts`
- Modify: `apps/api/src/db/schema/index.ts`

**Interfaces:**
- Produces tables: `project`, `projectTeam`, `task`, `milestone`, `taskStatus`, `projectStatus`, `taskLabel`, `projectLabel`, `taskLabelLink`, `projectLabelLink` (plus their `*Relations`).

- [ ] **Step 1: Create `apps/api/src/db/schema/projects.ts`**

```ts
import { relations } from "drizzle-orm";
import {
	date,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization, team, user } from "./auth";

// ---------- Taxonomy (org-wide) ----------

export const taskStatus = pgTable("task_status", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	name: text("name").notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectStatus = pgTable("project_status", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	name: text("name").notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskLabel = pgTable("task_label", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	color: text("color"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectLabel = pgTable("project_label", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	color: text("color"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Project ----------

export const project = pgTable("project", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	statusId: text("status_id")
		.notNull()
		.references(() => projectStatus.id, { onDelete: "restrict" }),
	color: text("color"),
	startDate: date("start_date", { mode: "string" }),
	endDate: date("end_date", { mode: "string" }),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	archivedAt: timestamp("archived_at"),
});

export const projectTeam = pgTable(
	"project_team",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		teamId: uuid("team_id")
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.projectId, t.teamId] })],
);

export const projectLabelLink = pgTable(
	"project_label_link",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		projectLabelId: text("project_label_id")
			.notNull()
			.references(() => projectLabel.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.projectId, t.projectLabelId] })],
);

// ---------- Task ----------

export const task = pgTable("task", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	parentId: text("parent_id"),
	name: text("name").notNull(),
	description: text("description"),
	statusId: text("status_id")
		.notNull()
		.references(() => taskStatus.id, { onDelete: "restrict" }),
	priority: text("priority").notNull().default("none"),
	progress: integer("progress").notNull().default(0),
	startDate: date("start_date", { mode: "string" }),
	endDate: date("end_date", { mode: "string" }),
	color: text("color"),
	assigneeId: uuid("assignee_id").references(() => user.id, {
		onDelete: "set null",
	}),
	position: integer("position").notNull().default(0),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const taskLabelLink = pgTable(
	"task_label_link",
	{
		taskId: text("task_id")
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		taskLabelId: text("task_label_id")
			.notNull()
			.references(() => taskLabel.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.taskId, t.taskLabelId] })],
);

// ---------- Milestone ----------

export const milestone = pgTable("milestone", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	date: date("date", { mode: "string" }).notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	completedAt: timestamp("completed_at"),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

// ---------- Relations ----------

export const projectRelations = relations(project, ({ one, many }) => ({
	organization: one(organization, {
		fields: [project.organizationId],
		references: [organization.id],
	}),
	status: one(projectStatus, {
		fields: [project.statusId],
		references: [projectStatus.id],
	}),
	tasks: many(task),
	milestones: many(milestone),
	teams: many(projectTeam),
	labelLinks: many(projectLabelLink),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
	project: one(project, {
		fields: [task.projectId],
		references: [project.id],
	}),
	status: one(taskStatus, {
		fields: [task.statusId],
		references: [taskStatus.id],
	}),
	parent: one(task, {
		fields: [task.parentId],
		references: [task.id],
		relationName: "subtasks",
	}),
	children: many(task, { relationName: "subtasks" }),
	assignee: one(user, {
		fields: [task.assigneeId],
		references: [user.id],
	}),
	labelLinks: many(taskLabelLink),
}));

export const milestoneRelations = relations(milestone, ({ one }) => ({
	project: one(project, {
		fields: [milestone.projectId],
		references: [project.id],
	}),
}));

export const taskStatusRelations = relations(taskStatus, ({ many }) => ({
	tasks: many(task),
}));

export const projectStatusRelations = relations(projectStatus, ({ many }) => ({
	projects: many(project),
}));

export const taskLabelRelations = relations(taskLabel, ({ many }) => ({
	links: many(taskLabelLink),
}));

export const projectLabelRelations = relations(projectLabel, ({ many }) => ({
	links: many(projectLabelLink),
}));

export const projectTeamRelations = relations(projectTeam, ({ one }) => ({
	project: one(project, {
		fields: [projectTeam.projectId],
		references: [project.id],
	}),
	team: one(team, {
		fields: [projectTeam.teamId],
		references: [team.id],
	}),
}));

export const taskLabelLinkRelations = relations(taskLabelLink, ({ one }) => ({
	task: one(task, {
		fields: [taskLabelLink.taskId],
		references: [task.id],
	}),
	label: one(taskLabel, {
		fields: [taskLabelLink.taskLabelId],
		references: [taskLabel.id],
	}),
}));

export const projectLabelLinkRelations = relations(
	projectLabelLink,
	({ one }) => ({
		project: one(project, {
			fields: [projectLabelLink.projectId],
			references: [project.id],
		}),
		label: one(projectLabel, {
			fields: [projectLabelLink.projectLabelId],
			references: [projectLabel.id],
		}),
	}),
);
```

- [ ] **Step 2: Add the barrel export to `apps/api/src/db/schema/index.ts`**

Add this line with the other exports:

```ts
export * from "./projects";
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS (no type errors).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/schema
git commit -m "feat(db): add project/task/milestone/status/label tables"
```

---

### Task 3: Generate & apply migration

**Files:**
- Create: `apps/api/src/db/migrations/<generated>.sql` (Drizzle output — do not hand-edit)

- [ ] **Step 1: Ensure Postgres is running**

Run: `docker compose -f docker-compose-local.yml up -d`
Expected: postgres container healthy on port 5433.

- [ ] **Step 2: Generate the migration**

Run: `cd apps/api && pnpm db:generate`
Expected: a new migration file appears under `apps/api/src/db/migrations/` containing `CREATE TABLE "project"`, `"task"`, `"milestone"`, `"task_status"`, `"project_status"`, `"task_label"`, `"project_label"`, `"project_team"`, `"task_label_link"`, `"project_label_link"`.

- [ ] **Step 3: Apply the migration**

Run: `cd apps/api && pnpm db:migrate`
Expected: migration applies with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/migrations
git commit -m "chore(db): generate projects/tasks migration"
```

---

### Task 4: Org default seed helpers (TDD)

**Files:**
- Create: `apps/api/src/projects/org-defaults.ts`
- Create: `apps/api/src/projects/org-defaults.spec.ts`

**Interfaces:**
- Produces: `humanizeStatusType(type: string): string`; `buildDefaultTaskStatuses(): { type: TaskStatusType; name: string }[]`; `buildDefaultProjectStatuses(): { type: ProjectStatusType; name: string }[]`; `pickDefaultStatusId(statuses: { id: string; type: string; position: number }[], preferredType: string): string`; `ensureOrgDefaults(db: Db, orgId: string): Promise<void>`.

- [ ] **Step 1: Write the failing test `apps/api/src/projects/org-defaults.spec.ts`**

```ts
import {
	buildDefaultProjectStatuses,
	buildDefaultTaskStatuses,
	humanizeStatusType,
	pickDefaultStatusId,
} from "./org-defaults";

describe("org-defaults helpers", () => {
	it("humanizes status types", () => {
		expect(humanizeStatusType("in_progress")).toBe("In Progress");
		expect(humanizeStatusType("backlog")).toBe("Backlog");
	});

	it("builds the 5 default task statuses in order", () => {
		const statuses = buildDefaultTaskStatuses();
		expect(statuses.map((s) => s.type)).toEqual([
			"backlog",
			"planned",
			"in_progress",
			"done",
			"canceled",
		]);
		expect(statuses[2].name).toBe("In Progress");
	});

	it("builds the 5 default project statuses in order", () => {
		const statuses = buildDefaultProjectStatuses();
		expect(statuses.map((s) => s.type)).toEqual([
			"draft",
			"planning",
			"execution",
			"monitoring",
			"completed",
		]);
	});

	it("picks the preferred-type status with the lowest position", () => {
		const rows = [
			{ id: "a", type: "planned", position: 0 },
			{ id: "b", type: "backlog", position: 1 },
			{ id: "c", type: "backlog", position: 0 },
		];
		expect(pickDefaultStatusId(rows, "backlog")).toBe("c");
	});

	it("falls back to the lowest-position status when preferred type is absent", () => {
		const rows = [
			{ id: "a", type: "planned", position: 2 },
			{ id: "b", type: "done", position: 1 },
		];
		expect(pickDefaultStatusId(rows, "backlog")).toBe("b");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test -- org-defaults`
Expected: FAIL — cannot find module `./org-defaults`.

- [ ] **Step 3: Implement `apps/api/src/projects/org-defaults.ts`**

```ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
	PROJECT_STATUS_TYPES,
	type ProjectStatusType,
	TASK_STATUS_TYPES,
	type TaskStatusType,
} from "@orbit/shared";
import type { Db } from "../db/db.module";
import * as schema from "../db/schema";

export function humanizeStatusType(type: string): string {
	return type
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function buildDefaultTaskStatuses(): {
	type: TaskStatusType;
	name: string;
}[] {
	return TASK_STATUS_TYPES.map((type) => ({
		type,
		name: humanizeStatusType(type),
	}));
}

export function buildDefaultProjectStatuses(): {
	type: ProjectStatusType;
	name: string;
}[] {
	return PROJECT_STATUS_TYPES.map((type) => ({
		type,
		name: humanizeStatusType(type),
	}));
}

export function pickDefaultStatusId(
	statuses: { id: string; type: string; position: number }[],
	preferredType: string,
): string {
	const sorted = [...statuses].sort((a, b) => a.position - b.position);
	const preferred = sorted.find((s) => s.type === preferredType);
	const chosen = preferred ?? sorted[0];
	if (!chosen) {
		throw new Error("No statuses available to pick a default from");
	}
	return chosen.id;
}

// Idempotent: seeds default statuses only if the org has none yet.
export async function ensureOrgDefaults(db: Db, orgId: string): Promise<void> {
	const existingTask = await db.query.taskStatus.findFirst({
		where: eq(schema.taskStatus.organizationId, orgId),
	});
	if (!existingTask) {
		await db.insert(schema.taskStatus).values(
			buildDefaultTaskStatuses().map((s, index) => ({
				id: randomUUID(),
				organizationId: orgId,
				type: s.type,
				name: s.name,
				position: index,
			})),
		);
	}

	const existingProject = await db.query.projectStatus.findFirst({
		where: eq(schema.projectStatus.organizationId, orgId),
	});
	if (!existingProject) {
		await db.insert(schema.projectStatus).values(
			buildDefaultProjectStatuses().map((s, index) => ({
				id: randomUUID(),
				organizationId: orgId,
				type: s.type,
				name: s.name,
				position: index,
			})),
		);
	}
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test -- org-defaults`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/org-defaults.ts apps/api/src/projects/org-defaults.spec.ts
git commit -m "feat(projects): add org default-status seed helpers"
```

---

### Task 5: Seed defaults on org creation + backfill

**Files:**
- Modify: `apps/api/src/auth/organization-billing-hooks.ts` (inside `afterCreateOrganization`)
- Create: `apps/api/src/db/seeds/init/org-status-defaults.ts`
- Modify: `apps/api/src/db/seed.ts` (register init seed)

**Interfaces:**
- Consumes: `ensureOrgDefaults` (Task 4).

- [ ] **Step 1: Call `ensureOrgDefaults` in the org-create hook**

In `apps/api/src/auth/organization-billing-hooks.ts`, add the import near the other local imports:

```ts
import { ensureOrgDefaults } from "../projects/org-defaults";
```

Then, inside `afterCreateOrganization: async ({ organization: org, user: owner }) => {`, add as the **first** statement of the handler body:

```ts
			await ensureOrgDefaults(db, org.id);
```

(`db` is already in scope — it's a parameter of `createOrganizationHooks({ db, ... })`.)

- [ ] **Step 2: Create the backfill init seed `apps/api/src/db/seeds/init/org-status-defaults.ts`**

```ts
import type { Db } from "../../db.module";
import { ensureOrgDefaults } from "../../../projects/org-defaults";
import * as schema from "../../schema";

export async function seedOrgStatusDefaults(db: Db): Promise<void> {
	const orgs = await db.select({ id: schema.organization.id }).from(
		schema.organization,
	);
	for (const org of orgs) {
		await ensureOrgDefaults(db, org.id);
	}
	console.log(`Ensured status defaults for ${orgs.length} org(s).`);
}
```

- [ ] **Step 3: Register the init seed in `apps/api/src/db/seed.ts`**

Add the import after the existing imports at the top (extensionless, matching the existing static relative imports in this file):

```ts
import { seedOrgStatusDefaults } from "./seeds/init/org-status-defaults";
```

Replace the empty `initSeeds` array:

```ts
const initSeeds: { name: string; fn: (db: Db) => Promise<void> }[] = [];
```

with:

```ts
const initSeeds: { name: string; fn: (db: Db) => Promise<void> }[] = [
	{ name: "org-status-defaults", fn: seedOrgStatusDefaults },
];
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Backfill existing dev orgs**

Run: `cd apps/api && pnpm db:seed`
Expected: logs `Ensured status defaults for N org(s).` with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/organization-billing-hooks.ts apps/api/src/db/seed.ts apps/api/src/db/seeds/init/org-status-defaults.ts
git commit -m "feat(projects): seed default statuses on org create + backfill"
```

---

### Task 6: Statuses service & controller

**Files:**
- Create: `apps/api/src/projects/statuses/statuses.service.ts`
- Create: `apps/api/src/projects/statuses/statuses.controller.ts`

**Interfaces:**
- Consumes: `ensureOrgDefaults` (Task 4); schemas `createTaskStatusSchema`, `updateTaskStatusSchema`, `createProjectStatusSchema`, `updateProjectStatusSchema`, `deleteStatusSchema`.
- Produces: `StatusesService` with `listTaskStatuses(orgId)`, `createTaskStatus(orgId, input)`, `updateTaskStatus(id, orgId, input)`, `deleteTaskStatus(id, orgId, reassignTo?)` and the matching `*ProjectStatus*` methods.

- [ ] **Step 1: Create `apps/api/src/projects/statuses/statuses.service.ts`**

```ts
import { randomUUID } from "node:crypto";
import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	CreateProjectStatusInput,
	CreateTaskStatusInput,
	UpdateProjectStatusInput,
	UpdateTaskStatusInput,
} from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ensureOrgDefaults } from "../org-defaults";

@Injectable()
export class StatusesService {
	constructor(@Inject(DB) private readonly db: Db) {}

	// ── Task statuses ──────────────────────────────────────────────

	async listTaskStatuses(orgId: string) {
		await ensureOrgDefaults(this.db, orgId);
		return this.db.query.taskStatus.findMany({
			where: eq(schema.taskStatus.organizationId, orgId),
			orderBy: [asc(schema.taskStatus.position)],
		});
	}

	async createTaskStatus(orgId: string, input: CreateTaskStatusInput) {
		const id = randomUUID();
		await this.db.insert(schema.taskStatus).values({
			id,
			organizationId: orgId,
			type: input.type,
			name: input.name,
			color: input.color,
			position: input.position ?? 0,
		});
		return this.getTaskStatus(id, orgId);
	}

	async updateTaskStatus(
		id: string,
		orgId: string,
		input: UpdateTaskStatusInput,
	) {
		await this.getTaskStatus(id, orgId);
		await this.db
			.update(schema.taskStatus)
			.set(input)
			.where(eq(schema.taskStatus.id, id));
		return this.getTaskStatus(id, orgId);
	}

	async deleteTaskStatus(id: string, orgId: string, reassignTo?: string) {
		await this.getTaskStatus(id, orgId);
		await this.db.transaction(async (tx) => {
			const inUse = await tx.query.task.findFirst({
				where: eq(schema.task.statusId, id),
			});
			if (inUse) {
				if (!reassignTo) {
					throw new ConflictException(
						"Status is in use; provide reassignTo to migrate tasks first",
					);
				}
				const target = await tx.query.taskStatus.findFirst({
					where: and(
						eq(schema.taskStatus.id, reassignTo),
						eq(schema.taskStatus.organizationId, orgId),
					),
				});
				if (!target) throw new NotFoundException("reassignTo status not found");
				await tx
					.update(schema.task)
					.set({ statusId: reassignTo })
					.where(eq(schema.task.statusId, id));
			}
			await tx.delete(schema.taskStatus).where(eq(schema.taskStatus.id, id));
		});
		return { deleted: true };
	}

	private async getTaskStatus(id: string, orgId: string) {
		const row = await this.db.query.taskStatus.findFirst({
			where: and(
				eq(schema.taskStatus.id, id),
				eq(schema.taskStatus.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Task status not found");
		return row;
	}

	// ── Project statuses ───────────────────────────────────────────

	async listProjectStatuses(orgId: string) {
		await ensureOrgDefaults(this.db, orgId);
		return this.db.query.projectStatus.findMany({
			where: eq(schema.projectStatus.organizationId, orgId),
			orderBy: [asc(schema.projectStatus.position)],
		});
	}

	async createProjectStatus(orgId: string, input: CreateProjectStatusInput) {
		const id = randomUUID();
		await this.db.insert(schema.projectStatus).values({
			id,
			organizationId: orgId,
			type: input.type,
			name: input.name,
			color: input.color,
			position: input.position ?? 0,
		});
		return this.getProjectStatus(id, orgId);
	}

	async updateProjectStatus(
		id: string,
		orgId: string,
		input: UpdateProjectStatusInput,
	) {
		await this.getProjectStatus(id, orgId);
		await this.db
			.update(schema.projectStatus)
			.set(input)
			.where(eq(schema.projectStatus.id, id));
		return this.getProjectStatus(id, orgId);
	}

	async deleteProjectStatus(id: string, orgId: string, reassignTo?: string) {
		await this.getProjectStatus(id, orgId);
		await this.db.transaction(async (tx) => {
			const inUse = await tx.query.project.findFirst({
				where: eq(schema.project.statusId, id),
			});
			if (inUse) {
				if (!reassignTo) {
					throw new ConflictException(
						"Status is in use; provide reassignTo to migrate projects first",
					);
				}
				const target = await tx.query.projectStatus.findFirst({
					where: and(
						eq(schema.projectStatus.id, reassignTo),
						eq(schema.projectStatus.organizationId, orgId),
					),
				});
				if (!target) throw new NotFoundException("reassignTo status not found");
				await tx
					.update(schema.project)
					.set({ statusId: reassignTo })
					.where(eq(schema.project.statusId, id));
			}
			await tx
				.delete(schema.projectStatus)
				.where(eq(schema.projectStatus.id, id));
		});
		return { deleted: true };
	}

	private async getProjectStatus(id: string, orgId: string) {
		const row = await this.db.query.projectStatus.findFirst({
			where: and(
				eq(schema.projectStatus.id, id),
				eq(schema.projectStatus.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Project status not found");
		return row;
	}
}
```

- [ ] **Step 2: Create `apps/api/src/projects/statuses/statuses.controller.ts`**

```ts
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	createProjectStatusSchema,
	createTaskStatusSchema,
	deleteStatusSchema,
	updateProjectStatusSchema,
	updateTaskStatusSchema,
} from "@orbit/shared";
import type { Session } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { StatusesService } from "./statuses.service";

@UseGuards(AuthGuard)
@Controller()
export class StatusesController {
	constructor(private readonly statuses: StatusesService) {}

	@Get("task-statuses")
	listTask(@CurrentSession() session: Session) {
		return this.statuses.listTaskStatuses(this.orgId(session));
	}

	@Post("task-statuses")
	createTask(@CurrentSession() session: Session, @Body() body: unknown) {
		const input = createTaskStatusSchema.parse(body);
		return this.statuses.createTaskStatus(this.orgId(session), input);
	}

	@Patch("task-statuses/:id")
	updateTask(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const input = updateTaskStatusSchema.parse(body);
		return this.statuses.updateTaskStatus(id, this.orgId(session), input);
	}

	@Delete("task-statuses/:id")
	deleteTask(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const { reassignTo } = deleteStatusSchema.parse(body ?? {});
		return this.statuses.deleteTaskStatus(id, this.orgId(session), reassignTo);
	}

	@Get("project-statuses")
	listProject(@CurrentSession() session: Session) {
		return this.statuses.listProjectStatuses(this.orgId(session));
	}

	@Post("project-statuses")
	createProject(@CurrentSession() session: Session, @Body() body: unknown) {
		const input = createProjectStatusSchema.parse(body);
		return this.statuses.createProjectStatus(this.orgId(session), input);
	}

	@Patch("project-statuses/:id")
	updateProject(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const input = updateProjectStatusSchema.parse(body);
		return this.statuses.updateProjectStatus(id, this.orgId(session), input);
	}

	@Delete("project-statuses/:id")
	deleteProject(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const { reassignTo } = deleteStatusSchema.parse(body ?? {});
		return this.statuses.deleteProjectStatus(
			id,
			this.orgId(session),
			reassignTo,
		);
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
```

- [ ] **Step 3: Typecheck & lint**

Run: `cd apps/api && pnpm typecheck` then from root `pnpm check apps/api/src/projects`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/projects/statuses
git commit -m "feat(projects): statuses service & controller with reassign-on-delete"
```

---

### Task 7: Labels service & controller

**Files:**
- Create: `apps/api/src/projects/labels/labels.service.ts`
- Create: `apps/api/src/projects/labels/labels.controller.ts`

**Interfaces:**
- Consumes: schemas `createLabelSchema`, `updateLabelSchema`.
- Produces: `LabelsService` with `listTaskLabels(orgId)`, `createTaskLabel(orgId, input)`, `updateTaskLabel(id, orgId, input)`, `deleteTaskLabel(id, orgId)` and matching `*ProjectLabel*` methods.

- [ ] **Step 1: Create `apps/api/src/projects/labels/labels.service.ts`**

```ts
import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateLabelInput, UpdateLabelInput } from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";

@Injectable()
export class LabelsService {
	constructor(@Inject(DB) private readonly db: Db) {}

	listTaskLabels(orgId: string) {
		return this.db.query.taskLabel.findMany({
			where: eq(schema.taskLabel.organizationId, orgId),
			orderBy: [asc(schema.taskLabel.name)],
		});
	}

	async createTaskLabel(orgId: string, input: CreateLabelInput) {
		const id = randomUUID();
		await this.db.insert(schema.taskLabel).values({
			id,
			organizationId: orgId,
			name: input.name,
			color: input.color,
		});
		return this.getTaskLabel(id, orgId);
	}

	async updateTaskLabel(id: string, orgId: string, input: UpdateLabelInput) {
		await this.getTaskLabel(id, orgId);
		await this.db
			.update(schema.taskLabel)
			.set(input)
			.where(eq(schema.taskLabel.id, id));
		return this.getTaskLabel(id, orgId);
	}

	async deleteTaskLabel(id: string, orgId: string) {
		await this.getTaskLabel(id, orgId);
		await this.db.delete(schema.taskLabel).where(eq(schema.taskLabel.id, id));
		return { deleted: true };
	}

	private async getTaskLabel(id: string, orgId: string) {
		const row = await this.db.query.taskLabel.findFirst({
			where: and(
				eq(schema.taskLabel.id, id),
				eq(schema.taskLabel.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Task label not found");
		return row;
	}

	listProjectLabels(orgId: string) {
		return this.db.query.projectLabel.findMany({
			where: eq(schema.projectLabel.organizationId, orgId),
			orderBy: [asc(schema.projectLabel.name)],
		});
	}

	async createProjectLabel(orgId: string, input: CreateLabelInput) {
		const id = randomUUID();
		await this.db.insert(schema.projectLabel).values({
			id,
			organizationId: orgId,
			name: input.name,
			color: input.color,
		});
		return this.getProjectLabel(id, orgId);
	}

	async updateProjectLabel(id: string, orgId: string, input: UpdateLabelInput) {
		await this.getProjectLabel(id, orgId);
		await this.db
			.update(schema.projectLabel)
			.set(input)
			.where(eq(schema.projectLabel.id, id));
		return this.getProjectLabel(id, orgId);
	}

	async deleteProjectLabel(id: string, orgId: string) {
		await this.getProjectLabel(id, orgId);
		await this.db
			.delete(schema.projectLabel)
			.where(eq(schema.projectLabel.id, id));
		return { deleted: true };
	}

	private async getProjectLabel(id: string, orgId: string) {
		const row = await this.db.query.projectLabel.findFirst({
			where: and(
				eq(schema.projectLabel.id, id),
				eq(schema.projectLabel.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Project label not found");
		return row;
	}
}
```

- [ ] **Step 2: Create `apps/api/src/projects/labels/labels.controller.ts`**

```ts
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { createLabelSchema, updateLabelSchema } from "@orbit/shared";
import type { Session } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { LabelsService } from "./labels.service";

@UseGuards(AuthGuard)
@Controller()
export class LabelsController {
	constructor(private readonly labels: LabelsService) {}

	@Get("task-labels")
	listTask(@CurrentSession() session: Session) {
		return this.labels.listTaskLabels(this.orgId(session));
	}

	@Post("task-labels")
	createTask(@CurrentSession() session: Session, @Body() body: unknown) {
		return this.labels.createTaskLabel(
			this.orgId(session),
			createLabelSchema.parse(body),
		);
	}

	@Patch("task-labels/:id")
	updateTask(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.labels.updateTaskLabel(
			id,
			this.orgId(session),
			updateLabelSchema.parse(body),
		);
	}

	@Delete("task-labels/:id")
	deleteTask(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.labels.deleteTaskLabel(id, this.orgId(session));
	}

	@Get("project-labels")
	listProject(@CurrentSession() session: Session) {
		return this.labels.listProjectLabels(this.orgId(session));
	}

	@Post("project-labels")
	createProject(@CurrentSession() session: Session, @Body() body: unknown) {
		return this.labels.createProjectLabel(
			this.orgId(session),
			createLabelSchema.parse(body),
		);
	}

	@Patch("project-labels/:id")
	updateProject(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.labels.updateProjectLabel(
			id,
			this.orgId(session),
			updateLabelSchema.parse(body),
		);
	}

	@Delete("project-labels/:id")
	deleteProject(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.labels.deleteProjectLabel(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
```

- [ ] **Step 3: Typecheck & lint**

Run: `cd apps/api && pnpm typecheck` then from root `pnpm check apps/api/src/projects`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/projects/labels
git commit -m "feat(projects): labels service & controller (task + project)"
```

---

### Task 8: Projects service & controller

**Files:**
- Create: `apps/api/src/projects/projects/projects.service.ts`
- Create: `apps/api/src/projects/projects/projects.controller.ts`

**Interfaces:**
- Consumes: `ensureOrgDefaults`, `pickDefaultStatusId` (Task 4); schemas `createProjectSchema`, `updateProjectSchema`, `setProjectTeamsSchema`.
- Produces: `ProjectsService.assertProjectInOrg(projectId, orgId)` reused by Tasks/Milestones services (Tasks 9–10); plus `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `setTeams`, `setLabels`.

- [ ] **Step 1: Create `apps/api/src/projects/projects/projects.service.ts`**

```ts
import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	CreateProjectInput,
	UpdateProjectInput,
} from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ensureOrgDefaults, pickDefaultStatusId } from "../org-defaults";

@Injectable()
export class ProjectsService {
	constructor(@Inject(DB) private readonly db: Db) {}

	listProjects(orgId: string) {
		return this.db.query.project.findMany({
			where: eq(schema.project.organizationId, orgId),
			orderBy: [asc(schema.project.createdAt)],
		});
	}

	async getProject(id: string, orgId: string) {
		const row = await this.db.query.project.findFirst({
			where: and(
				eq(schema.project.id, id),
				eq(schema.project.organizationId, orgId),
			),
			with: {
				status: true,
				teams: true,
				labelLinks: true,
			},
		});
		if (!row) throw new NotFoundException("Project not found");
		return row;
	}

	// Used by Tasks & Milestones services to verify project ownership.
	async assertProjectInOrg(projectId: string, orgId: string) {
		const row = await this.db.query.project.findFirst({
			columns: { id: true },
			where: and(
				eq(schema.project.id, projectId),
				eq(schema.project.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Project not found");
	}

	async createProject(orgId: string, userId: string, input: CreateProjectInput) {
		await ensureOrgDefaults(this.db, orgId);
		const statusId = input.statusId ?? (await this.defaultProjectStatusId(orgId));
		const id = randomUUID();
		await this.db.transaction(async (tx) => {
			await tx.insert(schema.project).values({
				id,
				organizationId: orgId,
				name: input.name,
				description: input.description,
				statusId,
				color: input.color,
				startDate: input.startDate,
				endDate: input.endDate,
				createdBy: userId,
			});
			if (input.teamIds?.length) {
				await tx.insert(schema.projectTeam).values(
					input.teamIds.map((teamId) => ({ projectId: id, teamId })),
				);
			}
			if (input.labelIds?.length) {
				await tx.insert(schema.projectLabelLink).values(
					input.labelIds.map((projectLabelId) => ({
						projectId: id,
						projectLabelId,
					})),
				);
			}
		});
		return this.getProject(id, orgId);
	}

	async updateProject(id: string, orgId: string, input: UpdateProjectInput) {
		await this.assertProjectInOrg(id, orgId);
		await this.db.transaction(async (tx) => {
			const { teamIds, labelIds, ...fields } = input;
			if (Object.keys(fields).length > 0) {
				await tx
					.update(schema.project)
					.set(fields)
					.where(eq(schema.project.id, id));
			}
			if (teamIds) {
				await tx
					.delete(schema.projectTeam)
					.where(eq(schema.projectTeam.projectId, id));
				if (teamIds.length) {
					await tx.insert(schema.projectTeam).values(
						teamIds.map((teamId) => ({ projectId: id, teamId })),
					);
				}
			}
			if (labelIds) {
				await tx
					.delete(schema.projectLabelLink)
					.where(eq(schema.projectLabelLink.projectId, id));
				if (labelIds.length) {
					await tx.insert(schema.projectLabelLink).values(
						labelIds.map((projectLabelId) => ({
							projectId: id,
							projectLabelId,
						})),
					);
				}
			}
		});
		return this.getProject(id, orgId);
	}

	async deleteProject(id: string, orgId: string) {
		await this.assertProjectInOrg(id, orgId);
		await this.db.delete(schema.project).where(eq(schema.project.id, id));
		return { deleted: true };
	}

	private async defaultProjectStatusId(orgId: string): Promise<string> {
		const statuses = await this.db.query.projectStatus.findMany({
			where: eq(schema.projectStatus.organizationId, orgId),
		});
		return pickDefaultStatusId(statuses, "draft");
	}
}
```

- [ ] **Step 2: Create `apps/api/src/projects/projects/projects.controller.ts`**

```ts
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	Put,
	UseGuards,
} from "@nestjs/common";
import {
	createProjectSchema,
	setProjectTeamsSchema,
	updateProjectSchema,
} from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ProjectsService } from "./projects.service";

@UseGuards(AuthGuard)
@Controller("projects")
export class ProjectsController {
	constructor(private readonly projects: ProjectsService) {}

	@Get()
	list(@CurrentSession() session: Session) {
		return this.projects.listProjects(this.orgId(session));
	}

	@Get(":id")
	get(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.projects.getProject(id, this.orgId(session));
	}

	@Post()
	create(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.projects.createProject(
			this.orgId(session),
			user.id,
			createProjectSchema.parse(body),
		);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.projects.updateProject(
			id,
			this.orgId(session),
			updateProjectSchema.parse(body),
		);
	}

	@Delete(":id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.projects.deleteProject(id, this.orgId(session));
	}

	@Put(":id/teams")
	setTeams(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const { teamIds } = setProjectTeamsSchema.parse(body);
		return this.projects.updateProject(id, this.orgId(session), { teamIds });
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
```

- [ ] **Step 3: Typecheck & lint**

Run: `cd apps/api && pnpm typecheck` then from root `pnpm check apps/api/src/projects`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/projects/projects
git commit -m "feat(projects): projects service & controller with teams/labels"
```

---

### Task 9: Tasks service & controller

**Files:**
- Create: `apps/api/src/projects/tasks/tasks.service.ts`
- Create: `apps/api/src/projects/tasks/tasks.controller.ts`

**Interfaces:**
- Consumes: `ProjectsService.assertProjectInOrg` (Task 8); `ensureOrgDefaults`, `pickDefaultStatusId` (Task 4); schemas `createTaskSchema`, `updateTaskSchema`, `moveTaskSchema`.
- Produces: `TasksService` with `listTasks`, `createTask`, `updateTask`, `deleteTask`, `moveTask`.

- [ ] **Step 1: Create `apps/api/src/projects/tasks/tasks.service.ts`**

```ts
import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	CreateTaskInput,
	MoveTaskInput,
	UpdateTaskInput,
} from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ensureOrgDefaults, pickDefaultStatusId } from "../org-defaults";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class TasksService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly projects: ProjectsService,
	) {}

	async listTasks(projectId: string, orgId: string) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		return this.db.query.task.findMany({
			where: eq(schema.task.projectId, projectId),
			orderBy: [asc(schema.task.position)],
			with: { labelLinks: true },
		});
	}

	async createTask(
		projectId: string,
		orgId: string,
		userId: string,
		input: CreateTaskInput,
	) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		await ensureOrgDefaults(this.db, orgId);
		const statusId = input.statusId ?? (await this.defaultTaskStatusId(orgId));
		const id = randomUUID();
		await this.db.transaction(async (tx) => {
			await tx.insert(schema.task).values({
				id,
				projectId,
				parentId: input.parentId,
				name: input.name,
				description: input.description,
				statusId,
				priority: input.priority ?? "none",
				progress: input.progress ?? 0,
				startDate: input.startDate,
				endDate: input.endDate,
				color: input.color,
				assigneeId: input.assigneeId,
				position: input.position ?? 0,
				createdBy: userId,
			});
			if (input.labelIds?.length) {
				await tx.insert(schema.taskLabelLink).values(
					input.labelIds.map((taskLabelId) => ({ taskId: id, taskLabelId })),
				);
			}
		});
		return this.getTask(id, orgId);
	}

	async updateTask(id: string, orgId: string, input: UpdateTaskInput) {
		await this.getTask(id, orgId);
		await this.db.transaction(async (tx) => {
			const { labelIds, ...fields } = input;
			if (Object.keys(fields).length > 0) {
				await tx.update(schema.task).set(fields).where(eq(schema.task.id, id));
			}
			if (labelIds) {
				await tx
					.delete(schema.taskLabelLink)
					.where(eq(schema.taskLabelLink.taskId, id));
				if (labelIds.length) {
					await tx.insert(schema.taskLabelLink).values(
						labelIds.map((taskLabelId) => ({ taskId: id, taskLabelId })),
					);
				}
			}
		});
		return this.getTask(id, orgId);
	}

	async moveTask(id: string, orgId: string, input: MoveTaskInput) {
		await this.getTask(id, orgId);
		await this.db
			.update(schema.task)
			.set({ parentId: input.parentId ?? null, position: input.position })
			.where(eq(schema.task.id, id));
		return this.getTask(id, orgId);
	}

	async deleteTask(id: string, orgId: string) {
		await this.getTask(id, orgId);
		await this.db.delete(schema.task).where(eq(schema.task.id, id));
		return { deleted: true };
	}

	// A task belongs to the org iff its project does. Join through project.
	private async getTask(id: string, orgId: string) {
		const row = await this.db.query.task.findFirst({
			where: eq(schema.task.id, id),
			with: { project: { columns: { organizationId: true } }, labelLinks: true },
		});
		if (!row || row.project.organizationId !== orgId) {
			throw new NotFoundException("Task not found");
		}
		return row;
	}

	private async defaultTaskStatusId(orgId: string): Promise<string> {
		const statuses = await this.db.query.taskStatus.findMany({
			where: eq(schema.taskStatus.organizationId, orgId),
		});
		return pickDefaultStatusId(statuses, "backlog");
	}
}
```

- [ ] **Step 2: Create `apps/api/src/projects/tasks/tasks.controller.ts`**

```ts
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	createTaskSchema,
	moveTaskSchema,
	updateTaskSchema,
} from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { TasksService } from "./tasks.service";

@UseGuards(AuthGuard)
@Controller()
export class TasksController {
	constructor(private readonly tasks: TasksService) {}

	@Get("projects/:projectId/tasks")
	list(
		@Param("projectId") projectId: string,
		@CurrentSession() session: Session,
	) {
		return this.tasks.listTasks(projectId, this.orgId(session));
	}

	@Post("projects/:projectId/tasks")
	create(
		@Param("projectId") projectId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.tasks.createTask(
			projectId,
			this.orgId(session),
			user.id,
			createTaskSchema.parse(body),
		);
	}

	@Patch("tasks/:id")
	update(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.tasks.updateTask(
			id,
			this.orgId(session),
			updateTaskSchema.parse(body),
		);
	}

	@Patch("tasks/:id/move")
	move(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.tasks.moveTask(
			id,
			this.orgId(session),
			moveTaskSchema.parse(body),
		);
	}

	@Delete("tasks/:id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.tasks.deleteTask(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
```

- [ ] **Step 3: Typecheck & lint**

Run: `cd apps/api && pnpm typecheck` then from root `pnpm check apps/api/src/projects`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/projects/tasks
git commit -m "feat(projects): tasks service & controller with move/labels"
```

---

### Task 10: Milestones service & controller

**Files:**
- Create: `apps/api/src/projects/milestones/milestones.service.ts`
- Create: `apps/api/src/projects/milestones/milestones.controller.ts`

**Interfaces:**
- Consumes: `ProjectsService.assertProjectInOrg` (Task 8); schemas `createMilestoneSchema`, `updateMilestoneSchema`.
- Produces: `MilestonesService` with `listMilestones`, `createMilestone`, `updateMilestone`, `deleteMilestone`.

- [ ] **Step 1: Create `apps/api/src/projects/milestones/milestones.service.ts`**

```ts
import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	CreateMilestoneInput,
	UpdateMilestoneInput,
} from "@orbit/shared";
import { asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class MilestonesService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly projects: ProjectsService,
	) {}

	async listMilestones(projectId: string, orgId: string) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		return this.db.query.milestone.findMany({
			where: eq(schema.milestone.projectId, projectId),
			orderBy: [asc(schema.milestone.date), asc(schema.milestone.position)],
		});
	}

	async createMilestone(
		projectId: string,
		orgId: string,
		userId: string,
		input: CreateMilestoneInput,
	) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		const id = randomUUID();
		await this.db.insert(schema.milestone).values({
			id,
			projectId,
			name: input.name,
			date: input.date,
			description: input.description,
			color: input.color,
			position: input.position ?? 0,
			createdBy: userId,
		});
		return this.getMilestone(id, orgId);
	}

	async updateMilestone(id: string, orgId: string, input: UpdateMilestoneInput) {
		await this.getMilestone(id, orgId);
		const { completedAt, ...rest } = input;
		await this.db
			.update(schema.milestone)
			.set({
				...rest,
				...(completedAt !== undefined
					? { completedAt: completedAt ? new Date(completedAt) : null }
					: {}),
			})
			.where(eq(schema.milestone.id, id));
		return this.getMilestone(id, orgId);
	}

	async deleteMilestone(id: string, orgId: string) {
		await this.getMilestone(id, orgId);
		await this.db.delete(schema.milestone).where(eq(schema.milestone.id, id));
		return { deleted: true };
	}

	private async getMilestone(id: string, orgId: string) {
		const row = await this.db.query.milestone.findFirst({
			where: eq(schema.milestone.id, id),
			with: { project: { columns: { organizationId: true } } },
		});
		if (!row || row.project.organizationId !== orgId) {
			throw new NotFoundException("Milestone not found");
		}
		return row;
	}
}
```

- [ ] **Step 2: Create `apps/api/src/projects/milestones/milestones.controller.ts`**

```ts
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	createMilestoneSchema,
	updateMilestoneSchema,
} from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { MilestonesService } from "./milestones.service";

@UseGuards(AuthGuard)
@Controller()
export class MilestonesController {
	constructor(private readonly milestones: MilestonesService) {}

	@Get("projects/:projectId/milestones")
	list(
		@Param("projectId") projectId: string,
		@CurrentSession() session: Session,
	) {
		return this.milestones.listMilestones(projectId, this.orgId(session));
	}

	@Post("projects/:projectId/milestones")
	create(
		@Param("projectId") projectId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.milestones.createMilestone(
			projectId,
			this.orgId(session),
			user.id,
			createMilestoneSchema.parse(body),
		);
	}

	@Patch("milestones/:id")
	update(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.milestones.updateMilestone(
			id,
			this.orgId(session),
			updateMilestoneSchema.parse(body),
		);
	}

	@Delete("milestones/:id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.milestones.deleteMilestone(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
```

- [ ] **Step 3: Typecheck & lint**

Run: `cd apps/api && pnpm typecheck` then from root `pnpm check apps/api/src/projects`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/projects/milestones
git commit -m "feat(projects): milestones service & controller"
```

---

### Task 11: Module wiring & integration check

**Files:**
- Create: `apps/api/src/projects/projects.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: all services & controllers from Tasks 6–10.

- [ ] **Step 1: Create `apps/api/src/projects/projects.module.ts`**

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LabelsController } from "./labels/labels.controller";
import { LabelsService } from "./labels/labels.service";
import { MilestonesController } from "./milestones/milestones.controller";
import { MilestonesService } from "./milestones/milestones.service";
import { ProjectsController } from "./projects/projects.controller";
import { ProjectsService } from "./projects/projects.service";
import { StatusesController } from "./statuses/statuses.controller";
import { StatusesService } from "./statuses/statuses.service";
import { TasksController } from "./tasks/tasks.controller";
import { TasksService } from "./tasks/tasks.service";

@Module({
	imports: [AuthModule],
	controllers: [
		ProjectsController,
		TasksController,
		MilestonesController,
		StatusesController,
		LabelsController,
	],
	providers: [
		ProjectsService,
		TasksService,
		MilestonesService,
		StatusesService,
		LabelsService,
	],
})
export class ProjectsModule {}
```

- [ ] **Step 2: Register `ProjectsModule` in `apps/api/src/app.module.ts`**

Add the import with the other module imports:

```ts
import { ProjectsModule } from "./projects/projects.module";
```

Add `ProjectsModule` to the `imports` array of the `@Module({...})` decorator (after `PreferencesModule`):

```ts
		PreferencesModule,
		ProjectsModule,
		UploadsModule,
```

- [ ] **Step 3: Full typecheck, lint, build**

Run: `pnpm typecheck && pnpm check && pnpm build`
Expected: all PASS.

- [ ] **Step 4: Boot the API to confirm routes register**

Run: `cd apps/api && pnpm dev` (or `pnpm start`), wait for startup, confirm no Nest DI errors in the log, then stop it.
Expected: log shows mapped routes including `/projects`, `/projects/:projectId/tasks`, `/projects/:projectId/milestones`, `/task-statuses`, `/project-statuses`, `/task-labels`, `/project-labels`. No "Nest can't resolve dependencies" errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/projects.module.ts apps/api/src/app.module.ts
git commit -m "feat(projects): wire ProjectsModule into the app"
```

---

## Self-review notes

- **Spec coverage:** every table, schema, endpoint, the seeding mechanism, status delete-with-reassign, and label replace-all map to Tasks 1–11. Frontend wiring and role restrictions remain out of scope per the spec.
- **Type consistency:** `ProjectsService.assertProjectInOrg` is defined in Task 8 and consumed in Tasks 9–10; `ensureOrgDefaults`/`pickDefaultStatusId`/`humanizeStatusType` defined in Task 4 and consumed in Tasks 5, 6, 8, 9; shared schema/type names match between definition (Task 1) and use (Tasks 6–10).
- **Org-scoping for tasks/milestones:** enforced by joining through `project.organizationId` in the private `getTask`/`getMilestone` and by `assertProjectInOrg` on list/create.
- **Known follow-ups (out of scope):** DB integration tests; validating that `assigneeId`/`labelIds`/`teamIds` reference same-org rows (currently FK-enforced for existence, not org membership); pagination on list endpoints.
```
