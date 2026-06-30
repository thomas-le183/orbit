# Project Timeline Data (Read-Path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/$orgSlug/projects/$projectId` render that project's tasks (fetched from the API) as timeline bars and its milestones as calendar-axis markers, replacing the static seed; the plain `/timeline` route keeps the seed.

**Architecture:** A `TimelineDataProvider` (React context) becomes the single source of timeline items, replacing `useTimelineItems` (which was a local `useState` called independently in `ItemsLayer` and `TimelineTable`). With a `projectId` it fetches tasks + milestones (TanStack Query), maps them via a pure `mapProjectData`, and seeds local state (so local drag/resize keeps working, unpersisted). Without a `projectId` it seeds from the static seed. A `MilestoneMarkers` layer draws diamonds on the axis.

**Tech Stack:** React 19, TanStack Query, TanStack Router, Vitest + Testing Library (happy-dom), `@orbit/ui`.

**Spec:** `docs/superpowers/specs/2026-06-30-project-timeline-data-design.md`

## Global Constraints

- Run from `apps/web`: `pnpm test` (vitest), `pnpm typecheck` (tsc). `pnpm check` (biome) from repo root.
- Server state via TanStack Query; HTTP via axios `api` from `@/lib/api`. Query keys in `*Keys` objects (mirror `hooks/use-projects.ts`).
- Biome **tabs**. No `any`. Extensionless relative imports. `cn()` from `@orbit/shared`.
- Drag/resize edits are **local-only** (not persisted) this slice. `assignee`/`status` mapping are **out of scope** (bars show color + name + progress).
- **Undated tasks** (no start/end) are excluded from bars this slice and surfaced only as an "N unscheduled" count; empty-lane rows + click-to-create are a separate follow-up plan.
- Never hand-edit `routeTree.gen.ts`.

## Scope note

This plan is the **core read-path**. A follow-up plan covers click-to-create on empty lanes (a write-style interaction needing pointer→date inversion), paired with drag/resize persistence.

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/hooks/use-tasks.ts` | `Task`/`Milestone` types, `taskKeys`/`milestoneKeys`, `useProjectTasks`, `useProjectMilestones` |
| `apps/web/src/hooks/use-tasks.test.tsx` | hook tests |
| `apps/web/src/components/timeline/data/map-items.ts` | `DEFAULT_TASK_COLOR`, `mapProjectData`, marker/undated types |
| `apps/web/src/components/timeline/data/map-items.test.ts` | mapping tests |
| `apps/web/src/components/timeline/data/context.tsx` | `TimelineDataProvider` + `useTimelineData` |
| `apps/web/src/components/timeline/data/context.test.tsx` | provider tests |
| `apps/web/src/components/timeline/items-layer.tsx` | (modify) consume `useTimelineData`; loading/empty/error + unscheduled note |
| `apps/web/src/components/timeline/layout/timeline-table.tsx` | (modify) consume `useTimelineData` |
| `apps/web/src/components/timeline/use-timeline-items.ts` + `.test.tsx` | (delete) replaced by provider |
| `apps/web/src/components/timeline/milestone-markers.tsx` | milestone axis markers |
| `apps/web/src/components/timeline/milestone-markers.test.tsx` | marker tests |
| `apps/web/src/components/timeline/layout/split-layout.tsx` | (modify) render `<MilestoneMarkers/>` in the pinned band |
| `apps/web/src/routes/_workspace/$orgSlug/projects/$projectId.tsx` | (modify) wrap in `TimelineDataProvider projectId` |
| `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx` | (modify) wrap in `TimelineDataProvider` (seed) |
| existing timeline test files | (modify) wrap renders in `TimelineDataProvider` |

---

### Task 1: Task/Milestone data hooks (TDD)

**Files:**
- Create: `apps/web/src/hooks/use-tasks.ts`
- Create: `apps/web/src/hooks/use-tasks.test.tsx`

**Interfaces:**
- Produces: `type Task`, `type Milestone`, `taskKeys.list(projectId)`, `milestoneKeys.list(projectId)`, `useProjectTasks(projectId: string)`, `useProjectMilestones(projectId: string)`.

- [ ] **Step 1: Write the failing test `apps/web/src/hooks/use-tasks.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useProjectMilestones, useProjectTasks } from "./use-tasks";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));

function makeWrapper() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const Wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
	return { Wrapper };
}

describe("useProjectTasks", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fetches tasks for the project", async () => {
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "t1", name: "Task" }],
		});
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjectTasks("proj1"), {
			wrapper: Wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects/proj1/tasks");
		expect(result.current.data).toEqual([{ id: "t1", name: "Task" }]);
	});

	it("is disabled without a projectId", () => {
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjectTasks(""), {
			wrapper: Wrapper,
		});
		expect(result.current.fetchStatus).toBe("idle");
		expect(api.get).not.toHaveBeenCalled();
	});
});

describe("useProjectMilestones", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fetches milestones for the project", async () => {
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "m1", name: "MS", date: "2026-07-01" }],
		});
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjectMilestones("proj1"), {
			wrapper: Wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects/proj1/milestones");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- use-tasks`
Expected: FAIL — cannot resolve `./use-tasks`.

- [ ] **Step 3: Implement `apps/web/src/hooks/use-tasks.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Task = {
	id: string;
	projectId: string;
	parentId: string | null;
	name: string;
	description: string | null;
	statusId: string;
	priority: string;
	progress: number;
	startDate: string | null;
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
	date: string;
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

export function useProjectTasks(projectId: string) {
	return useQuery({
		queryKey: taskKeys.list(projectId),
		queryFn: async () => {
			const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`);
			return data;
		},
		enabled: !!projectId,
	});
}

export function useProjectMilestones(projectId: string) {
	return useQuery({
		queryKey: milestoneKeys.list(projectId),
		queryFn: async () => {
			const { data } = await api.get<Milestone[]>(
				`/projects/${projectId}/milestones`,
			);
			return data;
		},
		enabled: !!projectId,
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- use-tasks`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-tasks.ts apps/web/src/hooks/use-tasks.test.tsx
git commit -m "feat(web): add useProjectTasks / useProjectMilestones hooks"
```

---

### Task 2: Mapping (TDD)

**Files:**
- Create: `apps/web/src/components/timeline/data/map-items.ts`
- Create: `apps/web/src/components/timeline/data/map-items.test.ts`

**Interfaces:**
- Consumes: `Task`, `Milestone` (Task 1); `TimelineItem` from `@/data/timeline-items`.
- Produces: `DEFAULT_TASK_COLOR`; `type UndatedTaskRow = { id: string; name: string; parentId: string | null }`; `type MilestoneMarker = { id: string; date: string; name: string; color: string }`; `mapProjectData(tasks, milestones): { items: TimelineItem[]; undatedTaskRows: UndatedTaskRow[]; milestoneMarkers: MilestoneMarker[] }`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/timeline/data/map-items.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Milestone, Task } from "@/hooks/use-tasks";
import { DEFAULT_TASK_COLOR, mapProjectData } from "./map-items";

function task(partial: Partial<Task>): Task {
	return {
		id: "t",
		projectId: "p",
		parentId: null,
		name: "T",
		description: null,
		statusId: "s",
		priority: "none",
		progress: 0,
		startDate: null,
		endDate: null,
		color: null,
		assigneeId: null,
		position: 0,
		createdAt: "2026-06-01T00:00:00Z",
		updatedAt: "2026-06-01T00:00:00Z",
		...partial,
	};
}

describe("mapProjectData", () => {
	it("maps a dated task to a timeline bar with color fallback", () => {
		const { items } = mapProjectData(
			[task({ id: "t1", name: "Alpha", startDate: "2026-06-01", endDate: "2026-06-03", progress: 40 })],
			[],
		);
		expect(items).toEqual([
			{
				id: "t1",
				kind: "task",
				name: "Alpha",
				parentId: null,
				startDate: "2026-06-01",
				endDate: "2026-06-03",
				progress: 40,
				color: DEFAULT_TASK_COLOR,
			},
		]);
	});

	it("backfills a missing end from start (and vice versa)", () => {
		const { items } = mapProjectData(
			[task({ id: "t2", startDate: "2026-06-05", endDate: null })],
			[],
		);
		expect(items[0].startDate).toBe("2026-06-05");
		expect(items[0].endDate).toBe("2026-06-05");
	});

	it("routes a task with no dates to undatedTaskRows", () => {
		const { items, undatedTaskRows } = mapProjectData(
			[task({ id: "t3", name: "NoDates", parentId: "p1" })],
			[],
		);
		expect(items).toHaveLength(0);
		expect(undatedTaskRows).toEqual([
			{ id: "t3", name: "NoDates", parentId: "p1" },
		]);
	});

	it("preserves a custom task color", () => {
		const { items } = mapProjectData(
			[task({ id: "t4", startDate: "2026-06-01", endDate: "2026-06-02", color: "#ff0000" })],
			[],
		);
		expect(items[0].color).toBe("#ff0000");
	});

	it("maps milestones to markers with color fallback", () => {
		const ms: Milestone = {
			id: "m1",
			projectId: "p",
			name: "Launch",
			description: null,
			date: "2026-07-01",
			color: null,
			position: 0,
			completedAt: null,
		};
		const { milestoneMarkers } = mapProjectData([], [ms]);
		expect(milestoneMarkers).toEqual([
			{ id: "m1", date: "2026-07-01", name: "Launch", color: DEFAULT_TASK_COLOR },
		]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- map-items`
Expected: FAIL — cannot resolve `./map-items`.

- [ ] **Step 3: Implement `apps/web/src/components/timeline/data/map-items.ts`**

```ts
import type { TimelineItem } from "@/data/timeline-items";
import type { Milestone, Task } from "@/hooks/use-tasks";

/** Fallback bar/marker color when a task/milestone has none. */
export const DEFAULT_TASK_COLOR = "#6366f1";

export type UndatedTaskRow = {
	id: string;
	name: string;
	parentId: string | null;
};

export type MilestoneMarker = {
	id: string;
	date: string;
	name: string;
	color: string;
};

/**
 * Split a project's tasks into dated timeline bars and undated rows, and map
 * milestones to axis markers. A task is "dated" if it has a start or end date;
 * the missing endpoint is backfilled from the present one.
 */
export function mapProjectData(
	tasks: Task[],
	milestones: Milestone[],
): {
	items: TimelineItem[];
	undatedTaskRows: UndatedTaskRow[];
	milestoneMarkers: MilestoneMarker[];
} {
	const items: TimelineItem[] = [];
	const undatedTaskRows: UndatedTaskRow[] = [];

	for (const t of tasks) {
		const start = t.startDate ?? t.endDate;
		const end = t.endDate ?? t.startDate;
		if (start && end) {
			items.push({
				id: t.id,
				kind: "task",
				name: t.name,
				parentId: t.parentId,
				startDate: start,
				endDate: end,
				progress: t.progress,
				color: t.color ?? DEFAULT_TASK_COLOR,
			});
		} else {
			undatedTaskRows.push({ id: t.id, name: t.name, parentId: t.parentId });
		}
	}

	const milestoneMarkers: MilestoneMarker[] = milestones.map((m) => ({
		id: m.id,
		date: m.date,
		name: m.name,
		color: m.color ?? DEFAULT_TASK_COLOR,
	}));

	return { items, undatedTaskRows, milestoneMarkers };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- map-items`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/data/map-items.ts apps/web/src/components/timeline/data/map-items.test.ts
git commit -m "feat(web): add project task/milestone → timeline mapping"
```

---

### Task 3: TimelineDataProvider (TDD)

**Files:**
- Create: `apps/web/src/components/timeline/data/context.tsx`
- Create: `apps/web/src/components/timeline/data/context.test.tsx`

**Interfaces:**
- Consumes: `useProjectTasks`/`useProjectMilestones` (Task 1); `mapProjectData` + marker/undated types (Task 2); `timelineItems` from `@/data/timeline-items`; `ONE_DAY`/`startOfUtcDay`/`toUtcDateString` from `../units/make-units`.
- Produces: `TimelineDataProvider({ projectId?, children })`; `useTimelineData(): { items: TimelineItem[]; updateItem(id, patch): void; moveDays(id, days): void; undatedTaskRows: UndatedTaskRow[]; milestoneMarkers: MilestoneMarker[]; isLoading: boolean; isError: boolean }`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/timeline/data/context.test.tsx`**

```tsx
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectMilestones, useProjectTasks } from "@/hooks/use-tasks";
import { TimelineDataProvider, useTimelineData } from "./context";

vi.mock("@/hooks/use-tasks", () => ({
	useProjectTasks: vi.fn(),
	useProjectMilestones: vi.fn(),
}));

const tasksMock = useProjectTasks as unknown as ReturnType<typeof vi.fn>;
const milestonesMock = useProjectMilestones as unknown as ReturnType<typeof vi.fn>;

function wrapper(projectId?: string) {
	return ({ children }: { children: ReactNode }) => (
		<TimelineDataProvider projectId={projectId}>{children}</TimelineDataProvider>
	);
}

describe("TimelineDataProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		tasksMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
		milestonesMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
	});

	it("seeds from the static seed when no projectId", () => {
		const { result } = renderHook(() => useTimelineData(), { wrapper: wrapper() });
		expect(result.current.items.length).toBeGreaterThan(0);
		expect(useProjectTasks).toHaveBeenCalledWith("");
	});

	it("maps query data into items + markers when projectId given", () => {
		tasksMock.mockReturnValue({
			data: [
				{
					id: "t1", projectId: "p", parentId: null, name: "Alpha",
					description: null, statusId: "s", priority: "none", progress: 0,
					startDate: "2026-06-01", endDate: "2026-06-02", color: null,
					assigneeId: null, position: 0, createdAt: "", updatedAt: "",
				},
			],
			isLoading: false, isError: false,
		});
		milestonesMock.mockReturnValue({
			data: [
				{ id: "m1", projectId: "p", name: "MS", description: null, date: "2026-07-01", color: null, position: 0, completedAt: null },
			],
			isLoading: false, isError: false,
		});
		const { result } = renderHook(() => useTimelineData(), { wrapper: wrapper("p") });
		expect(result.current.items.map((i) => i.id)).toEqual(["t1"]);
		expect(result.current.milestoneMarkers.map((m) => m.id)).toEqual(["m1"]);
	});

	it("updateItem mutates local state", () => {
		tasksMock.mockReturnValue({
			data: [
				{
					id: "t1", projectId: "p", parentId: null, name: "Alpha",
					description: null, statusId: "s", priority: "none", progress: 0,
					startDate: "2026-06-01", endDate: "2026-06-02", color: null,
					assigneeId: null, position: 0, createdAt: "", updatedAt: "",
				},
			],
			isLoading: false, isError: false,
		});
		const { result } = renderHook(() => useTimelineData(), { wrapper: wrapper("p") });
		act(() => result.current.updateItem("t1", { name: "Renamed" }));
		expect(result.current.items.find((i) => i.id === "t1")?.name).toBe("Renamed");
	});

	it("surfaces loading/error from the queries (projectId mode)", () => {
		tasksMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		milestonesMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
		const { result } = renderHook(() => useTimelineData(), { wrapper: wrapper("p") });
		expect(result.current.isLoading).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- "data/context"`
Expected: FAIL — cannot resolve `./context`.

- [ ] **Step 3: Implement `apps/web/src/components/timeline/data/context.tsx`**

```tsx
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { type TimelineItem, timelineItems } from "@/data/timeline-items";
import { useProjectMilestones, useProjectTasks } from "@/hooks/use-tasks";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";
import {
	mapProjectData,
	type MilestoneMarker,
	type UndatedTaskRow,
} from "./map-items";

/** Shift an item's own start/end dates by a whole-day delta. */
function shiftDates(item: TimelineItem, days: number): TimelineItem {
	const move = (iso: string) =>
		toUtcDateString(startOfUtcDay(Date.parse(iso)) + days * ONE_DAY);
	return { ...item, startDate: move(item.startDate), endDate: move(item.endDate) };
}

type TimelineDataValue = {
	items: TimelineItem[];
	updateItem: (id: string, patch: Partial<TimelineItem>) => void;
	moveDays: (id: string, days: number) => void;
	undatedTaskRows: UndatedTaskRow[];
	milestoneMarkers: MilestoneMarker[];
	isLoading: boolean;
	isError: boolean;
};

const TimelineDataContext = createContext<TimelineDataValue | null>(null);

export function TimelineDataProvider({
	projectId,
	children,
}: {
	projectId?: string;
	children: ReactNode;
}) {
	const tasksQuery = useProjectTasks(projectId ?? "");
	const milestonesQuery = useProjectMilestones(projectId ?? "");

	const mapped = useMemo(() => {
		if (!projectId) {
			return {
				items: timelineItems,
				undatedTaskRows: [] as UndatedTaskRow[],
				milestoneMarkers: [] as MilestoneMarker[],
			};
		}
		return mapProjectData(tasksQuery.data ?? [], milestonesQuery.data ?? []);
	}, [projectId, tasksQuery.data, milestonesQuery.data]);

	const [items, setItems] = useState<TimelineItem[]>(mapped.items);

	// Reseed local state when the underlying source changes (query resolves or
	// project switches). mapped.items keeps a stable ref between renders unless
	// the query data actually changed, so this does not clobber local edits on
	// unrelated re-renders. Local edits intentionally reset on refetch.
	useEffect(() => {
		setItems(mapped.items);
	}, [mapped.items]);

	const updateItem = useCallback((id: string, patch: Partial<TimelineItem>) => {
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
	}, []);

	const moveDays = useCallback((id: string, days: number) => {
		if (days === 0) return;
		setItems((prev) => {
			const hasChildren = prev.some((i) => i.parentId === id);
			if (!hasChildren) {
				return prev.map((i) => (i.id === id ? shiftDates(i, days) : i));
			}
			const descendants = new Set<string>();
			let added = true;
			while (added) {
				added = false;
				for (const i of prev) {
					if (
						i.parentId &&
						(i.parentId === id || descendants.has(i.parentId)) &&
						!descendants.has(i.id)
					) {
						descendants.add(i.id);
						added = true;
					}
				}
			}
			return prev.map((i) =>
				descendants.has(i.id) && !prev.some((c) => c.parentId === i.id)
					? shiftDates(i, days)
					: i,
			);
		});
	}, []);

	const value = useMemo<TimelineDataValue>(
		() => ({
			items,
			updateItem,
			moveDays,
			undatedTaskRows: mapped.undatedTaskRows,
			milestoneMarkers: mapped.milestoneMarkers,
			isLoading: projectId
				? tasksQuery.isLoading || milestonesQuery.isLoading
				: false,
			isError: projectId
				? tasksQuery.isError || milestonesQuery.isError
				: false,
		}),
		[
			items,
			updateItem,
			moveDays,
			mapped.undatedTaskRows,
			mapped.milestoneMarkers,
			projectId,
			tasksQuery.isLoading,
			tasksQuery.isError,
			milestonesQuery.isLoading,
			milestonesQuery.isError,
		],
	);

	return (
		<TimelineDataContext.Provider value={value}>
			{children}
		</TimelineDataContext.Provider>
	);
}

export function useTimelineData(): TimelineDataValue {
	const ctx = useContext(TimelineDataContext);
	if (!ctx) {
		throw new Error("useTimelineData must be used within a TimelineDataProvider");
	}
	return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- "data/context"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/data/context.tsx apps/web/src/components/timeline/data/context.test.tsx
git commit -m "feat(web): add TimelineDataProvider (single timeline data source)"
```

---

### Task 4: Switch consumers to the provider + wire routes

**Files:**
- Modify: `apps/web/src/components/timeline/items-layer.tsx`
- Modify: `apps/web/src/components/timeline/layout/timeline-table.tsx`
- Delete: `apps/web/src/components/timeline/use-timeline-items.ts`, `apps/web/src/components/timeline/use-timeline-items.test.tsx`
- Modify: `apps/web/src/routes/_workspace/$orgSlug/projects/$projectId.tsx`
- Modify: `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx`
- Modify (tests): `apps/web/src/components/timeline/items-layer.test.tsx`, `apps/web/src/components/timeline/layout/timeline-table.test.tsx`, `apps/web/src/components/timeline/layout/split-layout.test.tsx` (any test that renders `ItemsLayer`, `TimelineTable`, or `SplitLayout`).

**Interfaces:**
- Consumes: `useTimelineData` (Task 3); `TimelineDataProvider` (Task 3); `TimelineView` (existing).

- [ ] **Step 1: Point `items-layer.tsx` at the provider**

In `apps/web/src/components/timeline/items-layer.tsx`, change the import:
```ts
import { useTimelineItems } from "./use-timeline-items";
```
to:
```ts
import { useTimelineData } from "./data/context";
```
and change the call (line ~34):
```ts
	const { items, updateItem, moveDays } = useTimelineItems();
```
to:
```ts
	const { items, updateItem, moveDays } = useTimelineData();
```

- [ ] **Step 2: Point `timeline-table.tsx` at the provider**

In `apps/web/src/components/timeline/layout/timeline-table.tsx`, change the import:
```ts
import { useTimelineItems } from "../use-timeline-items";
```
to:
```ts
import { useTimelineData } from "../data/context";
```
and change BOTH call sites (`useOrderedIds` ~line 13 and `TimelineTable` ~line 46):
```ts
	const { items } = useTimelineItems();
```
to:
```ts
	const { items } = useTimelineData();
```

- [ ] **Step 3: Delete the obsolete hook + its test**

```bash
git rm apps/web/src/components/timeline/use-timeline-items.ts apps/web/src/components/timeline/use-timeline-items.test.tsx
```

(Its `moveDays`/`shiftDates` logic now lives in `data/context.tsx`, covered by `context.test.tsx`.)

- [ ] **Step 4: Wrap the project route in the provider with `projectId`**

Replace `apps/web/src/routes/_workspace/$orgSlug/projects/$projectId.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { TimelineDataProvider } from "@/components/timeline/data/context";
import TimelineView from "@/components/timeline/timeline-view";

export const Route = createFileRoute(
	"/_workspace/$orgSlug/projects/$projectId",
)({
	component: ProjectTimelinePage,
});

function ProjectTimelinePage() {
	const { projectId } = Route.useParams();
	return (
		<TimelineDataProvider projectId={projectId}>
			<TimelineView />
		</TimelineDataProvider>
	);
}
```

- [ ] **Step 5: Wrap the plain timeline route in the provider (seed)**

Replace `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { TimelineDataProvider } from "@/components/timeline/data/context";
import TimelineView from "@/components/timeline/timeline-view";

export const Route = createFileRoute("/_workspace/$orgSlug/timeline")({
	component: TimelinePage,
});

function TimelinePage() {
	return (
		<TimelineDataProvider>
			<TimelineView />
		</TimelineDataProvider>
	);
}
```

- [ ] **Step 6: Wrap existing component tests in the provider**

`ItemsLayer` and `TimelineTable` now require a `TimelineDataProvider` ancestor (they throw without one). For EACH test file that renders `ItemsLayer`, `TimelineTable`, `TimelineTableHeader`, or `SplitLayout` (at minimum `items-layer.test.tsx`, `layout/timeline-table.test.tsx`, `layout/split-layout.test.tsx`), import the provider and wrap the rendered tree. Example transform — change:

```tsx
render(
	<QueryClientProvider client={qc}>
		<SplitLayout tableHeader={<TimelineTableHeader />} table={<TimelineTable />} />
	</QueryClientProvider>,
);
```
to:

```tsx
import { TimelineDataProvider } from "../data/context"; // adjust relative depth per file

render(
	<QueryClientProvider client={qc}>
		<TimelineDataProvider>
			<SplitLayout tableHeader={<TimelineTableHeader />} table={<TimelineTable />} />
		</TimelineDataProvider>
	</QueryClientProvider>,
);
```

With no `projectId`, the provider serves the static seed, so existing assertions about seed rows still hold. (`TimelineDataProvider` calls `useProjectTasks("")`/`useProjectMilestones("")`, which are `enabled: false` and never hit the network — but a `QueryClientProvider` must still be present, which these tests already have. If a test renders `ItemsLayer`/`TimelineTable` WITHOUT a QueryClientProvider, add one.)

- [ ] **Step 7: Full verification**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: typecheck clean; the FULL web suite passes (every timeline test now wrapped). From repo root: `pnpm check apps/web/src/components/timeline apps/web/src/routes` — clean on touched files.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/timeline apps/web/src/routes
git commit -m "feat(web): timeline reads from TimelineDataProvider; project route fetches its tasks"
```

---

### Task 5: Milestone axis markers (TDD)

**Files:**
- Create: `apps/web/src/components/timeline/milestone-markers.tsx`
- Create: `apps/web/src/components/timeline/milestone-markers.test.tsx`
- Modify: `apps/web/src/components/timeline/layout/split-layout.tsx`

**Interfaces:**
- Consumes: `useTimelineData` (Task 3) for `milestoneMarkers`; `useTimelineController` + `useHorizontalPercentageOffset` from `../controller/*`; `startOfUtcDay` from `../units/make-units`.
- Produces: default export `MilestoneMarkers` (no props).

- [ ] **Step 1: Write the failing test `apps/web/src/components/timeline/milestone-markers.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneMarkers from "./milestone-markers";

vi.mock("./data/context", () => ({
	useTimelineData: () => ({
		milestoneMarkers: [
			{ id: "m1", date: "2026-07-01", name: "Launch", color: "#abc" },
			{ id: "m2", date: "2026-08-01", name: "GA", color: "#def" },
		],
	}),
}));
vi.mock("./controller/context", () => ({
	useTimelineController: () => ({ today: 0 }),
}));
vi.mock("./controller/hooks", () => ({
	useHorizontalPercentageOffset: () => ({ getPercentageOffset: () => 50 }),
}));

describe("MilestoneMarkers", () => {
	it("renders a marker per milestone with an accessible name", () => {
		render(<MilestoneMarkers />);
		const markers = screen.getAllByTestId("timeline-milestone-marker");
		expect(markers).toHaveLength(2);
		expect(screen.getByLabelText("Launch")).toBeInTheDocument();
		expect(screen.getByLabelText("GA")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- milestone-markers`
Expected: FAIL — cannot resolve `./milestone-markers`.

- [ ] **Step 3: Implement `apps/web/src/components/timeline/milestone-markers.tsx`**

```tsx
import { useTimelineController } from "./controller/context";
import { useHorizontalPercentageOffset } from "./controller/hooks";
import { useTimelineData } from "./data/context";
import { startOfUtcDay } from "./units/make-units";

/**
 * Diamond markers on the timeline axis, one per project milestone, positioned
 * at the milestone's date. Rendered over the pinned timeline background band.
 */
export default function MilestoneMarkers() {
	const { milestoneMarkers } = useTimelineData();
	const { today } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	if (milestoneMarkers.length === 0) return null;

	return (
		<div className="pointer-events-none absolute inset-0 z-10">
			{milestoneMarkers.map((m) => {
				const ms = startOfUtcDay(Date.parse(m.date)) - today;
				const left = getPercentageOffset(ms);
				if (!Number.isFinite(left) || left < 0 || left > 100) return null;
				return (
					<div
						key={m.id}
						data-testid="timeline-milestone-marker"
						aria-label={m.name}
						title={m.name}
						className="pointer-events-auto absolute top-0 -translate-x-1/2"
						style={{ left: `${left}%` }}
					>
						<div
							className="size-2.5 rotate-45 rounded-[2px] border border-background shadow-sm"
							style={{ backgroundColor: m.color }}
						/>
					</div>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- milestone-markers`
Expected: PASS (1 test).

- [ ] **Step 5: Render `MilestoneMarkers` in the pinned band of `split-layout.tsx`**

In `apps/web/src/components/timeline/layout/split-layout.tsx`, add the import with the other timeline imports:
```ts
import MilestoneMarkers from "../milestone-markers";
```
Then, inside the pinned timeline-background `<div>` that wraps `<TimelineGrid />` and `<NowLine />` (the one styled `className="absolute inset-y-0"` with `left`/`width`), add `<MilestoneMarkers />` as the last child:
```tsx
						<TimelineGrid />
						<NowLine />
						<MilestoneMarkers />
```

- [ ] **Step 6: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm test -- "timeline"` then from repo root `pnpm check apps/web/src/components/timeline`.
Expected: typecheck clean; timeline suites pass; biome clean. (`split-layout.test.tsx` already wraps in `TimelineDataProvider` from Task 4, so `MilestoneMarkers`' `useTimelineData` resolves; seed mode yields no markers, so existing assertions are unaffected.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/milestone-markers.tsx apps/web/src/components/timeline/milestone-markers.test.tsx apps/web/src/components/timeline/layout/split-layout.tsx
git commit -m "feat(web): render project milestones as timeline axis markers"
```

---

### Task 6: Loading / empty / error states + unscheduled note

**Files:**
- Modify: `apps/web/src/components/timeline/items-layer.tsx`

**Interfaces:**
- Consumes: `useTimelineData` (already wired in Task 4) — now also reads `isLoading`, `isError`, `undatedTaskRows`.

- [ ] **Step 1: Read the extra fields in `items-layer.tsx`**

Change the destructure (from Task 4):
```ts
	const { items, updateItem, moveDays } = useTimelineData();
```
to:
```ts
	const { items, updateItem, moveDays, isLoading, isError, undatedTaskRows } =
		useTimelineData();
```

- [ ] **Step 2: Render the state overlays inside the items content**

In the returned JSX of `ItemsLayer`, inside the root `<div data-testid="timeline-items-content" ...>` (the element whose height is `contentHeight(rows.length)`), add these overlays as the FIRST children (before the per-row lanes map). They are non-interactive hints layered over the grid:

```tsx
			{isError && (
				<div
					data-testid="timeline-items-error"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					Couldn't load tasks
				</div>
			)}
			{!isError && !isLoading && items.length === 0 && (
				<div
					data-testid="timeline-items-empty"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					No tasks yet
				</div>
			)}
			{undatedTaskRows.length > 0 && (
				<div
					data-testid="timeline-items-unscheduled"
					className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-muted-foreground"
				>
					{undatedTaskRows.length} unscheduled task
					{undatedTaskRows.length === 1 ? "" : "s"}
				</div>
			)}
```

(Loading shows nothing extra — the grid renders with empty lanes, no flash. The empty hint is suppressed during loading and on error.)

- [ ] **Step 3: Write a focused test `apps/web/src/components/timeline/items-layer.test.tsx` (add cases)**

Add a describe block that mounts `ItemsLayer` with a mocked `useTimelineData`. Follow the existing file's render setup (it already mocks `ResizeObserver` and wraps providers). Add:

```tsx
import { TimelineDataProvider } from "./data/context";
// ...
it("shows the empty state when there are no tasks and not loading", () => {
	// Render ItemsLayer within providers; with the seed provider replaced by a
	// projectId provider whose query returns []. Simplest: mock useTimelineData.
});
```

If mocking `useTimelineData` directly is cleaner than driving the provider, mock it:

```tsx
vi.mock("./data/context", async (orig) => {
	const actual = await orig<typeof import("./data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});
```
then in tests set its return value to exercise `isError`, empty `items`, and non-empty `undatedTaskRows`, asserting the three `data-testid`s appear/don't appear. Keep the existing tests working (give `useTimelineData` a default mock return with the seed items, or `vi.importActual` for them).

NOTE: the implementer chooses whichever of the two approaches keeps ALL existing `items-layer` tests green; the acceptance criteria are: empty state shows only when `!isLoading && !isError && items.length === 0`; error state shows on `isError`; unscheduled note shows when `undatedTaskRows.length > 0`.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- items-layer`
Expected: PASS (existing + new state cases).

- [ ] **Step 5: Full verification**

Run from repo root: `pnpm typecheck && pnpm check && cd apps/web && pnpm test`
Expected: typecheck clean; biome clean on touched files (pre-existing unrelated repo issues don't block); full web suite passes.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/items-layer.test.tsx
git commit -m "feat(web): timeline loading/empty/error states + unscheduled-task note"
```

---

## Self-review notes

- **Spec coverage:** data hooks (Task 1), mapping incl. dated/undated split + color fallback (Task 2), `TimelineDataProvider`/`useTimelineData` replacing `useTimelineItems` with seed fallback + local edits (Task 3), consumer switch + route wiring + test wrapping (Task 4), milestone axis markers (Task 5), loading/empty/error + unscheduled note (Task 6). Deferred per spec: persistence, assignee/status rendering, click-to-create + empty-lane rows (separate follow-up).
- **Type consistency:** `useProjectTasks(projectId)`/`useProjectMilestones(projectId)` (Task 1) → `mapProjectData(tasks, milestones)` (Task 2) → provider value `{ items, updateItem, moveDays, undatedTaskRows, milestoneMarkers, isLoading, isError }` (Task 3) consumed unchanged in Tasks 4–6. `MilestoneMarker`/`UndatedTaskRow` defined in Task 2, used in Tasks 3/5/6.
- **Risk:** Task 4 is the integration pivot — every test rendering the timeline components must gain a `TimelineDataProvider` wrapper, else they throw. Step 6 calls this out explicitly and the full-suite run in Step 7 is the gate.
- **Deviation from spec:** undated tasks are surfaced as an "N unscheduled" count (not yet empty-lane rows) — the spec's empty-lane rows + click-to-create move to the follow-up plan, per the scope decision. Undated tasks remain visible (as a count), nothing is silently dropped.
