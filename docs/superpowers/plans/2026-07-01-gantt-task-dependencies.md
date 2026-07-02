# Gantt Task Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag between connection nodes on timeline task bars to create persisted task-to-task dependencies, rendered as elbow connectors.

**Architecture:** New `task_dependency` table (predecessor/successor/type) → NestJS `DependenciesModule` (list/create/delete) → TanStack Query hooks with optimistic updates → timeline SVG `DependencyLayer` + per-bar connection nodes + a pointer-capture link-drag hook. Dependency `type` is a two-letter anchor code (`FS`/`SS`/`FF`/`SF`).

**Tech Stack:** Drizzle ORM + Postgres, NestJS, Zod (`@orbit/shared`), React 19, TanStack Query, `@tanstack/react-virtual` (already wired into the timeline), Vitest (web), Jest (api).

## Global Constraints

- All DB access through the Drizzle instance injected via the `DB` symbol; never raw SQL or another ORM.
- API endpoints use `@UseGuards(AuthGuard)` and derive `orgId` from `@CurrentSession()` via the controller's private `orgId(session)` helper (throws `ForbiddenException` when no active org).
- Request bodies are validated with a Zod schema from `@orbit/shared` via `schema.parse(body)` in the controller.
- Dependency `type` values: `FS | SS | FF | SF`. First letter = predecessor anchor, second = successor anchor (`F` = finish, `S` = start).
- Timeline row geometry constants live in `apps/web/src/components/timeline/layout/row-metrics.ts`: `ROW_HEIGHT = 40`, `ROW_PADDING = 7`. Bar vertical center for row `i` is exactly `i * ROW_HEIGHT + ROW_HEIGHT / 2`.
- Web query keys are colocated in a `*Keys` object; mutations do optimistic update + rollback + `sonner` toast on error, mirroring `apps/web/src/hooks/use-tasks.ts`.
- Out of scope this pass: cycle detection, date auto-scheduling, editing a link's type in place.

---

### Task 1: `task_dependency` schema + migration

**Files:**
- Modify: `apps/api/src/db/schema/projects.ts` (add table + relations; `task` already imports `AnyPgColumn`, `unique` may need importing)
- Create: migration under `apps/api/src/db/migrations/` (generated)

**Interfaces:**
- Produces: `taskDependency` table with columns `id, projectId, predecessorId, successorId, type, createdBy, createdAt`; exported const `taskDependency` and `taskDependencyRelations`.

- [ ] **Step 1: Add the table + relations**

At the end of the task-related tables in `apps/api/src/db/schema/projects.ts` (after `taskLabelLink`), add:

```ts
export const taskDependency = pgTable(
	"task_dependency",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		predecessorId: text("predecessor_id")
			.notNull()
			.references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
		successorId: text("successor_id")
			.notNull()
			.references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
		// Two-letter anchor code: FS | SS | FF | SF (predecessor anchor + successor anchor).
		type: text("type").notNull().default("FS"),
		createdBy: uuid("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		unique("task_dependency_edge_unique").on(
			t.predecessorId,
			t.successorId,
			t.type,
		),
	],
);

export const taskDependencyRelations = relations(taskDependency, ({ one }) => ({
	project: one(project, {
		fields: [taskDependency.projectId],
		references: [project.id],
	}),
	predecessor: one(task, {
		fields: [taskDependency.predecessorId],
		references: [task.id],
		relationName: "predecessor",
	}),
	successor: one(task, {
		fields: [taskDependency.successorId],
		references: [task.id],
		relationName: "successor",
	}),
}));
```

- [ ] **Step 2: Ensure `unique` is imported**

At the top of `apps/api/src/db/schema/projects.ts`, confirm the drizzle-orm/pg-core import list includes `unique`. If missing, add it to the existing `{ pgTable, ... }` import.

Run: `cd apps/api && pnpm typecheck`
Expected: PASS (no missing-symbol errors).

- [ ] **Step 3: Generate the migration**

Run: `cd apps/api && pnpm db:generate`
Expected: a new `apps/api/src/db/migrations/000X_*.sql` file is created containing `CREATE TABLE "task_dependency"` and a unique constraint on `(predecessor_id, successor_id, type)`.

- [ ] **Step 4: Apply the migration**

Run: `cd apps/api && pnpm db:migrate`
Expected: migration applies with no error (Postgres from `docker-compose-local.yml` must be up on port 5433).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/projects.ts apps/api/src/db/migrations
git commit -m "feat(api): add task_dependency table and migration"
```

---

### Task 2: Shared dependency Zod schema

**Files:**
- Create: `packages/shared/src/schemas/dependencies.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `DEPENDENCY_TYPES`, `DependencyType`, `createDependencySchema`, `CreateDependencyInput`.

- [ ] **Step 1: Create the schema**

Create `packages/shared/src/schemas/dependencies.ts`:

```ts
import { z } from "zod";

export const DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const createDependencySchema = z.object({
	predecessorId: z.string().min(1),
	successorId: z.string().min(1),
	type: z.enum(DEPENDENCY_TYPES).default("FS"),
});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
```

- [ ] **Step 2: Export it**

In `packages/shared/src/index.ts`, add next to the tasks export:

```ts
export * from "./schemas/dependencies.js";
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @orbit/shared typecheck && pnpm --filter @orbit/shared build`
Expected: PASS. `CreateDependencyInput` is now importable from `@orbit/shared`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/dependencies.ts packages/shared/src/index.ts
git commit -m "feat(shared): add createDependencySchema and dependency types"
```

---

### Task 3: `DependenciesService` (list/create/delete) + spec

**Files:**
- Create: `apps/api/src/projects/dependencies/dependencies.service.ts`
- Test: `apps/api/src/projects/dependencies/dependencies.service.spec.ts`

**Interfaces:**
- Consumes: `ProjectsService.assertProjectInOrg(projectId, orgId)`; `DB`/`Db` from `../../db/db.module`; `schema` from `../../db/schema`; `CreateDependencyInput` from `@orbit/shared`.
- Produces:
  - `listDependencies(projectId: string, orgId: string): Promise<DependencyRow[]>`
  - `createDependency(projectId: string, orgId: string, userId: string, input: CreateDependencyInput): Promise<DependencyRow>`
  - `deleteDependency(id: string, orgId: string): Promise<{ id: string }>`

- [ ] **Step 1: Write the failing spec**

Create `apps/api/src/projects/dependencies/dependencies.service.spec.ts`:

```ts
import { BadRequestException, ConflictException } from "@nestjs/common";
import { DependenciesService } from "./dependencies.service";

type Row = { id: string; projectId: string };

function createService(opts: {
	tasksInProject?: string[];
	existingEdge?: boolean;
} = {}) {
	const tasksInProject = new Set(opts.tasksInProject ?? ["t1", "t2"]);
	const insertValues = jest.fn().mockResolvedValue(undefined);
	const db = {
		query: {
			task: {
				findMany: jest.fn(async () =>
					[...tasksInProject].map((id) => ({ id })),
				),
			},
			taskDependency: {
				findFirst: jest.fn(async () =>
					opts.existingEdge ? { id: "dep-existing" } : undefined,
				),
				findMany: jest.fn(async () => [{ id: "dep1", projectId: "p1" }] as Row[]),
			},
		},
		insert: jest.fn(() => ({ values: insertValues })),
		delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
	};
	const projects = { assertProjectInOrg: jest.fn().mockResolvedValue(undefined) };
	const service = new DependenciesService(db as never, projects as never);
	return { service, db, projects, insertValues };
}

describe("DependenciesService.createDependency", () => {
	it("creates a dependency for two tasks in the project", async () => {
		const { service, insertValues, projects } = createService();
		await service.createDependency("p1", "org1", "user1", {
			predecessorId: "t1",
			successorId: "t2",
			type: "FS",
		});
		expect(projects.assertProjectInOrg).toHaveBeenCalledWith("p1", "org1");
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "p1",
				predecessorId: "t1",
				successorId: "t2",
				type: "FS",
				createdBy: "user1",
			}),
		);
	});

	it("rejects a self-link", async () => {
		const { service } = createService();
		await expect(
			service.createDependency("p1", "org1", "user1", {
				predecessorId: "t1",
				successorId: "t1",
				type: "FS",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("rejects a task that is not in the project", async () => {
		const { service } = createService({ tasksInProject: ["t1"] });
		await expect(
			service.createDependency("p1", "org1", "user1", {
				predecessorId: "t1",
				successorId: "t2",
				type: "FS",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("rejects a duplicate edge", async () => {
		const { service } = createService({ existingEdge: true });
		await expect(
			service.createDependency("p1", "org1", "user1", {
				predecessorId: "t1",
				successorId: "t2",
				type: "FS",
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd apps/api && pnpm test -- dependencies.service`
Expected: FAIL — cannot find `./dependencies.service`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/projects/dependencies/dependencies.service.ts`:

```ts
import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
} from "@nestjs/common";
import type { CreateDependencyInput } from "@orbit/shared";
import { and, eq, inArray } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class DependenciesService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly projects: ProjectsService,
	) {}

	async listDependencies(projectId: string, orgId: string) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		return this.db.query.taskDependency.findMany({
			where: eq(schema.taskDependency.projectId, projectId),
		});
	}

	async createDependency(
		projectId: string,
		orgId: string,
		userId: string,
		input: CreateDependencyInput,
	) {
		await this.projects.assertProjectInOrg(projectId, orgId);

		if (input.predecessorId === input.successorId) {
			throw new BadRequestException("A task cannot depend on itself");
		}

		const ids = [input.predecessorId, input.successorId];
		const found = await this.db.query.task.findMany({
			columns: { id: true },
			where: and(
				inArray(schema.task.id, ids),
				eq(schema.task.projectId, projectId),
			),
		});
		if (found.length !== 2) {
			throw new BadRequestException(
				"Both tasks must belong to this project",
			);
		}

		const existing = await this.db.query.taskDependency.findFirst({
			columns: { id: true },
			where: and(
				eq(schema.taskDependency.predecessorId, input.predecessorId),
				eq(schema.taskDependency.successorId, input.successorId),
				eq(schema.taskDependency.type, input.type),
			),
		});
		if (existing) {
			throw new ConflictException("This dependency already exists");
		}

		const id = randomUUID();
		await this.db.insert(schema.taskDependency).values({
			id,
			projectId,
			predecessorId: input.predecessorId,
			successorId: input.successorId,
			type: input.type,
			createdBy: userId,
		});
		return { id, projectId, ...input };
	}

	async deleteDependency(id: string, orgId: string) {
		const dep = await this.db.query.taskDependency.findFirst({
			where: eq(schema.taskDependency.id, id),
			with: { project: { columns: { organizationId: true } } },
		});
		if (!dep || dep.project.organizationId !== orgId) {
			throw new BadRequestException("Dependency not found");
		}
		await this.db
			.delete(schema.taskDependency)
			.where(eq(schema.taskDependency.id, id));
		return { id };
	}
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd apps/api && pnpm test -- dependencies.service`
Expected: PASS (4 tests). The `deleteDependency` path is covered by Task 4's typecheck + manual check; the spec covers create validation.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/dependencies/dependencies.service.ts apps/api/src/projects/dependencies/dependencies.service.spec.ts
git commit -m "feat(api): add DependenciesService with validation"
```

---

### Task 4: `DependenciesController` + module registration

**Files:**
- Create: `apps/api/src/projects/dependencies/dependencies.controller.ts`
- Modify: `apps/api/src/projects/projects.module.ts`

**Interfaces:**
- Consumes: `DependenciesService` (Task 3); `createDependencySchema` from `@orbit/shared`; `AuthGuard`, `CurrentSession`, `CurrentUser`, `Session`, `User`.
- Produces: routes `GET/POST projects/:projectId/dependencies`, `DELETE dependencies/:id`.

- [ ] **Step 1: Implement the controller**

Create `apps/api/src/projects/dependencies/dependencies.controller.ts`:

```ts
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import { createDependencySchema } from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { DependenciesService } from "./dependencies.service";

@UseGuards(AuthGuard)
@Controller()
export class DependenciesController {
	constructor(private readonly dependencies: DependenciesService) {}

	@Get("projects/:projectId/dependencies")
	list(
		@Param("projectId") projectId: string,
		@CurrentSession() session: Session,
	) {
		return this.dependencies.listDependencies(projectId, this.orgId(session));
	}

	@Post("projects/:projectId/dependencies")
	create(
		@Param("projectId") projectId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.dependencies.createDependency(
			projectId,
			this.orgId(session),
			user.id,
			createDependencySchema.parse(body),
		);
	}

	@Delete("dependencies/:id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.dependencies.deleteDependency(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
```

- [ ] **Step 2: Register in the module**

In `apps/api/src/projects/projects.module.ts`, add the imports and register the controller + provider:

```ts
import { DependenciesController } from "./dependencies/dependencies.controller";
import { DependenciesService } from "./dependencies/dependencies.service";
```

Add `DependenciesController` to the `controllers` array and `DependenciesService` to the `providers` array.

- [ ] **Step 3: Verify typecheck + build**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/projects/dependencies/dependencies.controller.ts apps/api/src/projects/projects.module.ts
git commit -m "feat(api): expose dependency endpoints"
```

---

### Task 5: Web data hooks (`use-dependencies.ts`)

**Files:**
- Create: `apps/web/src/hooks/use-dependencies.ts`
- Test: `apps/web/src/hooks/use-dependencies.test.tsx`

**Interfaces:**
- Consumes: `api` from `@/lib/api`; `CreateDependencyInput`, `DependencyType` from `@orbit/shared`.
- Produces:
  - `type Dependency = { id; projectId; predecessorId; successorId; type: DependencyType; createdAt? }`
  - `dependencyKeys.list(projectId)`
  - `useProjectDependencies(projectId)`, `useCreateDependency(projectId)`, `useDeleteDependency(projectId)`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/hooks/use-dependencies.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
	dependencyKeys,
	useCreateDependency,
	useProjectDependencies,
} from "./use-dependencies";

vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

function wrapper(qc: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

describe("useProjectDependencies", () => {
	it("fetches dependencies for the project", async () => {
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "d1", projectId: "p1", predecessorId: "a", successorId: "b", type: "FS" }],
		});
		const { result } = renderHook(() => useProjectDependencies("p1"), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects/p1/dependencies");
		expect(result.current.data?.[0].type).toBe("FS");
	});
});

describe("useCreateDependency", () => {
	it("posts to the dependencies endpoint and invalidates the list", async () => {
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const invalidate = vi.spyOn(qc, "invalidateQueries");
		(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { id: "d1", projectId: "p1", predecessorId: "a", successorId: "b", type: "FS" },
		});
		const { result } = renderHook(() => useCreateDependency("p1"), {
			wrapper: wrapper(qc),
		});
		await result.current.mutateAsync({ predecessorId: "a", successorId: "b", type: "FS" });
		expect(api.post).toHaveBeenCalledWith("/projects/p1/dependencies", {
			predecessorId: "a",
			successorId: "b",
			type: "FS",
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: dependencyKeys.list("p1") });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test -- --run src/hooks/use-dependencies.test.tsx`
Expected: FAIL — cannot resolve `./use-dependencies`.

- [ ] **Step 3: Implement the hooks**

Create `apps/web/src/hooks/use-dependencies.ts`:

```ts
import type { CreateDependencyInput, DependencyType } from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";

export type Dependency = {
	id: string;
	projectId: string;
	predecessorId: string;
	successorId: string;
	type: DependencyType;
	createdAt?: string;
};

export const dependencyKeys = {
	list: (projectId: string) => ["dependencies", "list", projectId] as const,
};

export function useProjectDependencies(projectId: string) {
	return useQuery({
		queryKey: dependencyKeys.list(projectId),
		queryFn: async () => {
			const { data } = await api.get<Dependency[]>(
				`/projects/${projectId}/dependencies`,
			);
			return data;
		},
		enabled: !!projectId,
	});
}

export function useCreateDependency(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateDependencyInput) => {
			const { data } = await api.post<Dependency>(
				`/projects/${projectId}/dependencies`,
				input,
			);
			return data;
		},
		onMutate: async (input) => {
			await qc.cancelQueries({ queryKey: dependencyKeys.list(projectId) });
			const previous = qc.getQueryData<Dependency[]>(
				dependencyKeys.list(projectId),
			);
			const optimistic: Dependency = {
				id: `optimistic-${crypto.randomUUID()}`,
				projectId,
				...input,
			};
			qc.setQueryData<Dependency[]>(dependencyKeys.list(projectId), (deps) => [
				...(deps ?? []),
				optimistic,
			]);
			return { previous };
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: dependencyKeys.list(projectId) });
		},
		onError: (err, _vars, context) => {
			if (context?.previous) {
				qc.setQueryData(dependencyKeys.list(projectId), context.previous);
			}
			toast.error(getErrorMessage(err, "Couldn't create dependency"));
		},
	});
}

export function useDeleteDependency(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/dependencies/${id}`);
			return id;
		},
		onMutate: async (id) => {
			await qc.cancelQueries({ queryKey: dependencyKeys.list(projectId) });
			const previous = qc.getQueryData<Dependency[]>(
				dependencyKeys.list(projectId),
			);
			qc.setQueryData<Dependency[]>(dependencyKeys.list(projectId), (deps) =>
				deps?.filter((d) => d.id !== id),
			);
			return { previous };
		},
		onError: (err, _id, context) => {
			if (context?.previous) {
				qc.setQueryData(dependencyKeys.list(projectId), context.previous);
			}
			toast.error(getErrorMessage(err, "Couldn't delete dependency"));
		},
	});
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- --run src/hooks/use-dependencies.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-dependencies.ts apps/web/src/hooks/use-dependencies.test.tsx
git commit -m "feat(web): add dependency query/mutation hooks"
```

---

### Task 6: Dependency geometry helpers (pure)

**Files:**
- Create: `apps/web/src/components/timeline/dependencies/geometry.ts`
- Test: `apps/web/src/components/timeline/dependencies/geometry.test.ts`

**Interfaces:**
- Consumes: `ROW_HEIGHT` from `../layout/row-metrics`.
- Produces:
  - `type Anchor = "start" | "finish"`
  - `rowCenterY(rowIndex: number): number`
  - `elbowPath(from: { x: number; y: number }, to: { x: number; y: number }): string`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/dependencies/geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { elbowPath, rowCenterY } from "./geometry";

describe("rowCenterY", () => {
	it("returns the vertical center of a row band", () => {
		expect(rowCenterY(0)).toBe(20); // ROW_HEIGHT 40 → 0*40 + 20
		expect(rowCenterY(3)).toBe(140); // 3*40 + 20
	});
});

describe("elbowPath", () => {
	it("routes through the horizontal midpoint between the two points", () => {
		expect(elbowPath({ x: 0, y: 20 }, { x: 100, y: 60 })).toBe(
			"M 0 20 L 50 20 L 50 60 L 100 60",
		);
	});

	it("handles a target to the left of the source", () => {
		expect(elbowPath({ x: 100, y: 20 }, { x: 0, y: 100 })).toBe(
			"M 100 20 L 50 20 L 50 100 L 0 100",
		);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/dependencies/geometry.test.ts`
Expected: FAIL — cannot resolve `./geometry`.

- [ ] **Step 3: Implement the geometry**

Create `apps/web/src/components/timeline/dependencies/geometry.ts`:

```ts
import { ROW_HEIGHT } from "../layout/row-metrics";

export type Anchor = "start" | "finish";

/** Vertical center (px) of the bar in row `rowIndex`. */
export function rowCenterY(rowIndex: number): number {
	return rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/**
 * Right-angle connector from `from` to `to`, routed through the horizontal
 * midpoint so the vertical run sits between the two bars. Rounded corners are
 * applied by the consumer via `stroke-linejoin: round`.
 */
export function elbowPath(
	from: { x: number; y: number },
	to: { x: number; y: number },
): string {
	const midX = (from.x + to.x) / 2;
	return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/dependencies/geometry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/dependencies/geometry.ts apps/web/src/components/timeline/dependencies/geometry.test.ts
git commit -m "feat(web): add dependency geometry helpers"
```

---

### Task 7: Link-drag interaction hook

**Files:**
- Create: `apps/web/src/components/timeline/use-link-interaction.ts`
- Test: `apps/web/src/components/timeline/use-link-interaction.test.ts`

**Interfaces:**
- Consumes: `Anchor` from `./dependencies/geometry`; `DependencyType` from `@orbit/shared`.
- Produces:
  - `anchorCode(a: Anchor): "S" | "F"`
  - `dependencyType(from: Anchor, to: Anchor): DependencyType`
  - `resolveLinkTarget(el: Element | null): { taskId: string; anchor: Anchor } | null`
  - `useLinkInteraction(opts: { onCreate: (from: {taskId,anchor}, to: {taskId,anchor}) => void }): { linkDraft; beginLink }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/use-link-interaction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	anchorCode,
	dependencyType,
	resolveLinkTarget,
} from "./use-link-interaction";

describe("dependencyType", () => {
	it("composes the two-letter anchor code", () => {
		expect(anchorCode("finish")).toBe("F");
		expect(anchorCode("start")).toBe("S");
		expect(dependencyType("finish", "start")).toBe("FS");
		expect(dependencyType("start", "finish")).toBe("SF");
		expect(dependencyType("start", "start")).toBe("SS");
		expect(dependencyType("finish", "finish")).toBe("FF");
	});
});

describe("resolveLinkTarget", () => {
	it("reads the task id and anchor from the nearest node element", () => {
		const wrap = document.createElement("div");
		wrap.innerHTML =
			'<span data-link-target="t9" data-link-anchor="finish"><i></i></span>';
		const inner = wrap.querySelector("i");
		expect(resolveLinkTarget(inner)).toEqual({ taskId: "t9", anchor: "finish" });
	});

	it("returns null when no node is under the element", () => {
		const el = document.createElement("div");
		expect(resolveLinkTarget(el)).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/use-link-interaction.test.ts`
Expected: FAIL — cannot resolve `./use-link-interaction`.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/components/timeline/use-link-interaction.ts`:

```ts
import type { DependencyType } from "@orbit/shared";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Anchor } from "./dependencies/geometry";

export type LinkEndpoint = { taskId: string; anchor: Anchor };

export const anchorCode = (a: Anchor): "S" | "F" =>
	a === "finish" ? "F" : "S";

export const dependencyType = (from: Anchor, to: Anchor): DependencyType =>
	`${anchorCode(from)}${anchorCode(to)}` as DependencyType;

/** Nearest ancestor carrying `data-link-target`, read as a link endpoint. */
export function resolveLinkTarget(el: Element | null): LinkEndpoint | null {
	const node = el?.closest("[data-link-target]") as HTMLElement | null;
	if (!node) return null;
	const taskId = node.dataset.linkTarget;
	const anchor = node.dataset.linkAnchor as Anchor | undefined;
	if (!taskId || (anchor !== "start" && anchor !== "finish")) return null;
	return { taskId, anchor };
}

export type LinkDraft = {
	from: LinkEndpoint;
	pointer: { x: number; y: number };
};

/**
 * Pointer-driven dependency creation. Mirrors use-bar-interaction: window
 * listeners + capture, a single active gesture. Produces a live `linkDraft`
 * used to draw the ghost connector; on release, resolves the target under the
 * cursor and calls `onCreate` when it is a different task.
 */
export function useLinkInteraction(opts: {
	onCreate: (from: LinkEndpoint, to: LinkEndpoint) => void;
}): {
	linkDraft: LinkDraft | null;
	beginLink: (e: ReactPointerEvent, from: LinkEndpoint) => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;
	const activeRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);
	const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);

	useEffect(() => {
		return () => {
			if (activeRef.current) {
				window.removeEventListener("pointermove", activeRef.current.move);
				window.removeEventListener("pointerup", activeRef.current.up);
				activeRef.current = null;
			}
		};
	}, []);

	const beginLink = useCallback((e: ReactPointerEvent, from: LinkEndpoint) => {
		if (activeRef.current) return;
		e.stopPropagation();
		e.preventDefault();
		setLinkDraft({ from, pointer: { x: e.clientX, y: e.clientY } });

		const onMove = (ev: PointerEvent) => {
			setLinkDraft({ from, pointer: { x: ev.clientX, y: ev.clientY } });
		};
		const onUp = (ev: PointerEvent) => {
			const target = resolveLinkTarget(
				document.elementFromPoint(ev.clientX, ev.clientY),
			);
			if (target && target.taskId !== from.taskId) {
				optsRef.current.onCreate(from, target);
			}
			setLinkDraft(null);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			activeRef.current = null;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		activeRef.current = { move: onMove, up: onUp };
	}, []);

	return { linkDraft, beginLink };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/use-link-interaction.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/use-link-interaction.ts apps/web/src/components/timeline/use-link-interaction.test.ts
git commit -m "feat(web): add link-drag interaction hook"
```

---

### Task 8: Expose dependencies through `TimelineDataContext`

**Files:**
- Modify: `apps/web/src/components/timeline/data/context.tsx`

**Interfaces:**
- Consumes: `useProjectDependencies`, `useCreateDependency`, `useDeleteDependency`, `Dependency` (Task 5); `CreateDependencyInput` from `@orbit/shared`.
- Produces (on the context value): `dependencies: Dependency[]`, `createDependency(input: CreateDependencyInput): void`, `deleteDependency(id: string): void`.

- [ ] **Step 1: Wire the hooks into the provider**

In `apps/web/src/components/timeline/data/context.tsx`:

Add imports:

```ts
import {
	type Dependency,
	useCreateDependency,
	useDeleteDependency,
	useProjectDependencies,
} from "@/hooks/use-dependencies";
import type { CreateDependencyInput } from "@orbit/shared";
```

Add to the `TimelineDataValue` type:

```ts
	dependencies: Dependency[];
	createDependency: (input: CreateDependencyInput) => void;
	deleteDependency: (id: string) => void;
```

Inside `TimelineDataProvider`, alongside the existing queries:

```ts
	const dependenciesQuery = useProjectDependencies(projectId ?? "");
	const createDependencyMut = useCreateDependency(projectId ?? "");
	const deleteDependencyMut = useDeleteDependency(projectId ?? "");
```

Add to the context `value` object (memoized alongside the rest):

```ts
	dependencies: projectId ? (dependenciesQuery.data ?? []) : [],
	createDependency: (input) => createDependencyMut.mutate(input),
	deleteDependency: (id) => deleteDependencyMut.mutate(id),
```

(If the value object is wrapped in `useMemo`, add `dependenciesQuery.data`, `createDependencyMut`, `deleteDependencyMut`, `projectId` to its dependency array.)

- [ ] **Step 2: Verify typecheck + existing tests still pass**

Run: `cd apps/web && pnpm typecheck && pnpm test -- --run src/components/timeline/data/context.test.tsx`
Expected: PASS. (The context test constructs the provider; new fields default to empty/no-op for the seed path.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/timeline/data/context.tsx
git commit -m "feat(web): expose dependencies through timeline data context"
```

---

### Task 9: `DependencyLayer` SVG overlay

**Files:**
- Create: `apps/web/src/components/timeline/dependencies/dependency-layer.tsx`
- Test: `apps/web/src/components/timeline/dependencies/dependency-layer.test.tsx`

**Interfaces:**
- Consumes: `useTimelineController` (`viewportWidth`, `today`), `useTimelineData` (`items`, `dependencies`, `deleteDependency`), `layoutItems`, `useHorizontalPercentageOffset`, `useVirtualRows`, `rowCenterY`, `elbowPath`, `contentHeight`, `LinkDraft`.
- Produces: `<DependencyLayer draft={draft} linkDraft={linkDraft} />` where `draft: Record<string, RelativeTimeRangeOffset>` (live bar drag) and `linkDraft: LinkDraft | null`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/dependencies/dependency-layer.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { timelineItems } from "@/data/timeline-items";
import {
	TimelineProvider,
	useTimelineController,
} from "../controller/context";
import { useTimelineData } from "../data/context";
import { DependencyLayer } from "./dependency-layer";

// DependencyLayer reads everything it needs from useTimelineData; mock it
// directly with the seed items plus one dependency between the first two.
vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderLayer() {
	const [a, b] = timelineItems;
	(useTimelineData as ReturnType<typeof vi.fn>).mockReturnValue({
		items: timelineItems,
		undatedTaskRows: [],
		milestoneMarkers: [],
		isLoading: false,
		isError: false,
		projectId: undefined,
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		scheduleTask: vi.fn(),
		dependencies: [
			{ id: "d1", projectId: "p1", predecessorId: a.id, successorId: b.id, type: "FS" },
		],
		createDependency: vi.fn(),
		deleteDependency: vi.fn(),
	});
	return render(
		<TimelineProvider initialZoom="weeks">
			<SizeViewport width={100000} />
			<DependencyLayer draft={{}} linkDraft={null} />
		</TimelineProvider>,
	);
}

describe("DependencyLayer", () => {
	it("renders one connector path per dependency", () => {
		const { container } = renderLayer();
		expect(
			container.querySelectorAll("[data-testid='dependency-link']").length,
		).toBe(1);
	});
});
```

Note: `timelineItems[0]` and `[1]` must be dated items that survive `layoutItems` as rows (they are, in the seed). If a seed item is a parent-only container its `range` is still defined, so the connector still renders.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/dependencies/dependency-layer.test.tsx`
Expected: FAIL — cannot resolve `./dependency-layer`.

- [ ] **Step 3: Implement the layer**

Create `apps/web/src/components/timeline/dependencies/dependency-layer.tsx`:

```tsx
import { useMemo } from "react";
import { useTimelineController } from "../controller/context";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { layoutItems } from "../controller/layout";
import { useTimelineData } from "../data/context";
import { contentHeight } from "../layout/row-metrics";
import { useVirtualRows } from "../layout/virtual-rows";
import type { RelativeTimeRangeOffset } from "../units/types";
import type { LinkDraft } from "../use-link-interaction";
import { type Anchor, elbowPath, rowCenterY } from "./geometry";

type RowInfo = { rowIndex: number; range: RelativeTimeRangeOffset };

export function DependencyLayer({
	draft,
	linkDraft,
}: {
	draft: Record<string, RelativeTimeRangeOffset>;
	linkDraft: LinkDraft | null;
}) {
	const { today, viewportWidth } = useTimelineController();
	const { items, dependencies, deleteDependency, undatedTaskRows } =
		useTimelineData();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { isSpanVisible } = useVirtualRows();

	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	const rowByTask = useMemo(() => {
		const map = new Map<string, RowInfo>();
		for (const row of rows) {
			map.set(row.item.id, { rowIndex: row.rowIndex, range: row.range });
		}
		return map;
	}, [rows]);

	if (viewportWidth <= 0) return null;

	const totalRows = rows.length + undatedTaskRows.length;
	const pxX = (percent: number) => (percent / 100) * viewportWidth;

	return (
		<svg
			data-testid="dependency-layer"
			className="pointer-events-none absolute inset-0 z-10"
			width="100%"
			height={contentHeight(totalRows)}
		>
			<defs>
				<marker
					id="dep-arrow"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
				</marker>
			</defs>

			{dependencies.map((dep) => {
				const from = rowByTask.get(dep.predecessorId);
				const to = rowByTask.get(dep.successorId);
				if (!from || !to) return null;
				if (!isSpanVisible(
					Math.min(from.rowIndex, to.rowIndex),
					Math.max(from.rowIndex, to.rowIndex),
				))
					return null;

				const fromAnchor: Anchor = dep.type[0] === "F" ? "finish" : "start";
				const toAnchor: Anchor = dep.type[1] === "F" ? "finish" : "start";
				const fromInfo = withDraft(from, draft, dep.predecessorId);
				const toInfo = withDraft(to, draft, dep.successorId);
				const p1 = { x: anchorXOf(fromInfo, fromAnchor, getPercentageOffset, pxX), y: rowCenterY(from.rowIndex) };
				const p2 = { x: anchorXOf(toInfo, toAnchor, getPercentageOffset, pxX), y: rowCenterY(to.rowIndex) };
				const midX = (p1.x + p2.x) / 2;

				return (
					<g key={dep.id} data-testid="dependency-link" className="group">
						<path
							d={elbowPath(p1, p2)}
							fill="none"
							strokeLinejoin="round"
							className="stroke-muted-foreground/70"
							strokeWidth={1.5}
							markerEnd="url(#dep-arrow)"
						/>
						{/* wide invisible hit area for hover/delete */}
						<path
							d={elbowPath(p1, p2)}
							fill="none"
							stroke="transparent"
							strokeWidth={10}
							className="pointer-events-auto cursor-pointer"
						/>
						<g
							className="pointer-events-auto cursor-pointer opacity-0 group-hover:opacity-100"
							onClick={() => deleteDependency(dep.id)}
						>
							<circle cx={midX} cy={(p1.y + p2.y) / 2} r={7} className="fill-background stroke-muted-foreground" />
							<path
								d={`M ${midX - 3} ${(p1.y + p2.y) / 2 - 3} L ${midX + 3} ${(p1.y + p2.y) / 2 + 3} M ${midX + 3} ${(p1.y + p2.y) / 2 - 3} L ${midX - 3} ${(p1.y + p2.y) / 2 + 3}`}
								className="stroke-muted-foreground"
								strokeWidth={1.5}
							/>
						</g>
					</g>
				);
			})}

			{linkDraft && (() => {
				const from = rowByTask.get(linkDraft.from.taskId);
				if (!from) return null;
				const fromInfo = withDraft(from, draft, linkDraft.from.taskId);
				const p1 = { x: anchorXOf(fromInfo, linkDraft.from.anchor, getPercentageOffset, pxX), y: rowCenterY(from.rowIndex) };
				// Convert pointer (client coords) into the svg's local coords.
				const svg = document.querySelector<SVGSVGElement>("[data-testid='dependency-layer']");
				const rect = svg?.getBoundingClientRect();
				const p2 = {
					x: rect ? linkDraft.pointer.x - rect.left : p1.x,
					y: rect ? linkDraft.pointer.y - rect.top : p1.y,
				};
				return (
					<path
						data-testid="dependency-ghost"
						d={elbowPath(p1, p2)}
						fill="none"
						strokeLinejoin="round"
						strokeDasharray="4 3"
						className="stroke-primary"
						strokeWidth={1.5}
						markerEnd="url(#dep-arrow)"
					/>
				);
			})()}
		</svg>
	);
}

/** Apply a live drag draft range to a row's stored range, if present. */
function withDraft(
	info: RowInfo,
	draft: Record<string, RelativeTimeRangeOffset>,
	taskId: string,
): RowInfo {
	const d = draft[taskId];
	return d ? { ...info, range: d } : info;
}

function anchorXOf(
	info: RowInfo,
	anchor: Anchor,
	getPercentageOffset: (ms: number) => number,
	pxX: (percent: number) => number,
): number {
	const ms = anchor === "finish" ? info.range.to : info.range.from;
	return pxX(getPercentageOffset(ms));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/dependencies/dependency-layer.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS.

```bash
git add apps/web/src/components/timeline/dependencies/dependency-layer.tsx apps/web/src/components/timeline/dependencies/dependency-layer.test.tsx
git commit -m "feat(web): render dependency connectors as an SVG overlay"
```

---

### Task 10: Connection nodes + mount the layer in `ItemsLayer`

**Files:**
- Modify: `apps/web/src/components/timeline/items-layer.tsx`
- Test: `apps/web/src/components/timeline/items-layer.test.tsx` (add cases)

**Interfaces:**
- Consumes: `useLinkInteraction`, `dependencyType`, `LinkEndpoint` (Task 7); `DependencyLayer` (Task 9); `useTimelineData().createDependency` (Task 8).
- Produces: rendered nodes `[data-testid="timeline-link-node"]` carrying `data-link-target` + `data-link-anchor`; `<DependencyLayer />` mounted with the existing `draft` and the hook's `linkDraft`.

- [ ] **Step 1: Add the failing test cases**

Append to `apps/web/src/components/timeline/items-layer.test.tsx` inside the existing `describe("ItemsLayer", ...)`:

```tsx
	it("hides connection nodes until a bar is hovered", async () => {
		const user = userEvent.setup();
		const { container } = renderLayer();
		const nodes = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-link-node']",
		);
		// Nodes exist in the DOM but are hidden (opacity-0) until hover.
		expect(nodes.length).toBeGreaterThan(0);
		expect(nodes[0].className).toContain("opacity-0");

		const bar = container.querySelector<HTMLElement>(
			"[data-testid='timeline-task-bar']",
		);
		if (bar) {
			await user.hover(bar);
		}
	});

	it("mounts the dependency layer", () => {
		const { container } = renderLayer();
		expect(
			container.querySelector("[data-testid='dependency-layer']"),
		).not.toBeNull();
	});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/items-layer.test.tsx`
Expected: FAIL — no `timeline-link-node` / `dependency-layer` yet.

- [ ] **Step 3: Wire the hook, nodes, and layer**

In `apps/web/src/components/timeline/items-layer.tsx`:

Add imports:

```ts
import { DependencyLayer } from "./dependencies/dependency-layer";
import type { Anchor } from "./dependencies/geometry";
import { dependencyType, useLinkInteraction } from "./use-link-interaction";
```

Pull `createDependency` from the data context (extend the existing destructure of `useTimelineData()`):

```ts
	const { /* existing */ createDependency } = useTimelineData();
```

Create the link hook near `useBarInteraction`:

```ts
	const { linkDraft, beginLink } = useLinkInteraction({
		onCreate: (from, to) =>
			createDependency({
				predecessorId: from.taskId,
				successorId: to.taskId,
				type: dependencyType(from.anchor, to.anchor),
			}),
	});
```

Add the two nodes as **siblings of the bar** (inside the same `<Fragment key={item.id}>`, right after the bar `<div>` and before the outside-label). They must NOT go inside the bar div — that div has `overflow-hidden`, which would clip a node centered on the edge. Positioning them in content-area coordinates (`left`/`right` percentages, `top + barHeight/2`) also keeps them aligned to the bar edges.

Crucially, hidden nodes must be `pointer-events-none` so they don't intercept the bar's resize handles when idle; during a link drag (`linkDraft` set) every bar's nodes become hittable targets:

```tsx
					{!row.isParent &&
						(
							[
								["start", left],
								["finish", right],
							] as [Anchor, number][]
						).map(([anchor, xPercent]) => (
							<span
								key={anchor}
								data-testid="timeline-link-node"
								data-link-target={item.id}
								data-link-anchor={anchor}
								onPointerDown={(e) =>
									beginLink(e, { taskId: item.id, anchor })
								}
								style={{ left: `${xPercent}%`, top: top + barHeight / 2 }}
								className={cn(
									"absolute z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-primary bg-background",
									hoveredId === item.id || linkDraft
										? "pointer-events-auto opacity-100"
										: "pointer-events-none opacity-0",
								)}
							/>
						))}
```

(`left`, `right`, `top`, and `barHeight` are already computed in that branch for the bar itself.)

At the end of the content `<div data-testid="timeline-items-content">`, just before `{dragTooltip}`, mount the layer:

```tsx
			<DependencyLayer draft={draft} linkDraft={linkDraft} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test -- --run src/components/timeline/items-layer.test.tsx`
Expected: PASS (existing + 2 new). If hovering changes bar markup, keep assertions on `timeline-link-node` presence + `opacity-0` default only.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `cd apps/web && pnpm typecheck` then from repo root `pnpm check`
Expected: PASS / no new warnings in changed files.

```bash
git add apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/items-layer.test.tsx
git commit -m "feat(web): add drag-to-create connection nodes and mount dependency layer"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + lint + tests**

Run from repo root:

```bash
pnpm typecheck
pnpm check
cd apps/web && pnpm test -- --run
cd ../api && pnpm test
```

Expected: typecheck + lint clean; web tests pass except the pre-existing unrelated `use-tasks.test.tsx` WIP failure (if still present on the branch); api tests pass including `dependencies.service`.

- [ ] **Step 2: Manual smoke test**

Ensure Postgres is up (`docker compose -f docker-compose-local.yml up -d`), run `pnpm dev`, open the `acme1` project timeline (seeded with 2k tasks), hover a bar to reveal its start/finish nodes, drag from one bar's finish node to another bar's start node, and confirm: an elbow connector with an arrowhead appears immediately (optimistic), survives a page reload (persisted), and hovering the link shows a ✕ that deletes it.

- [ ] **Step 3: Commit any doc/cleanup**

If the plan or spec needs a note about verified behavior, update and commit. Otherwise this task is complete.
```
