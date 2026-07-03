# Scheduler View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "scheduler" view mode that renders one row per assignee, packing each assignee's overlapping tasks into stacked sub-lanes on the shared timeline time-axis.

**Architecture:** Approach A — compose the existing timeline primitives (`TimelineProvider`, `TimeUnitsBar`, `TimelineGrid`, `NowLine`, `MilestoneMarkers`, `ZoomControl`, `usePan`, `TimelineScrollbar`, `useResizableDivider`) into a new `SchedulerLayout`. Pure modules handle grouping, greedy lane packing, and variable-height row metrics; a new `SchedulerLanes` component renders read-only bars using the shared `controller/geometry` helpers. The existing `SplitLayout`/`ItemsLayer` timeline path is left untouched.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind v4, TanStack Query, better-auth (org members).

## Global Constraints

- Package manager: `pnpm`. Run web tests from `apps/web`: `pnpm test`.
- TypeScript: `camelCase` values, `PascalCase` types/components. Avoid `any`.
- Styling: Tailwind v4; use `cn()` from `@orbit/shared` for conditional classes.
- Reuse existing timeline modules; do not fork the controller or geometry.
- Read-only scope: no drag/resize/reassign, no dependency links in the scheduler.
- Bars are selectable via the existing `RowSelectionProvider` / `useRowSelection` (the timeline's real click model — the spec's "click-to-open" is realized as click-to-select, since no task-detail view exists).
- Milestones excluded from group rows; shown only via the pinned `MilestoneMarkers` background.
- Parent tasks (tasks that have children) are excluded from group rows.

## File Structure

- Create `apps/web/src/components/timeline/scheduler/pack-lanes.ts` — greedy lane packing (pure).
- Create `apps/web/src/components/timeline/scheduler/pack-lanes.test.ts`.
- Create `apps/web/src/components/timeline/scheduler/group-rows.ts` — assignee grouping (pure).
- Create `apps/web/src/components/timeline/scheduler/group-rows.test.ts`.
- Create `apps/web/src/components/timeline/scheduler/row-metrics.ts` — height constants.
- Create `apps/web/src/components/timeline/scheduler/layout.ts` — `layoutScheduler` orchestrator (pure).
- Create `apps/web/src/components/timeline/scheduler/layout.test.ts`.
- Create `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx` — read-only bars renderer.
- Create `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx` — toolbar + axis + left column + body.
- Modify `apps/web/src/components/timeline/scheduler-view.tsx` — replace placeholder body.
- Modify `apps/web/src/components/timeline/data/map-items.ts` — resolve assignee.
- Modify `apps/web/src/components/timeline/data/map-items.test.ts` — assignee tests.
- Modify `apps/web/src/components/timeline/data/context.tsx` — pass members to `mapProjectData`.
- Modify `apps/web/src/hooks/use-auth.tsx` — add `useActiveOrgMembers`.
- Create `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` — integration test.

---

### Task 1: Resolve assignee in `mapProjectData`

**Files:**
- Modify: `apps/web/src/components/timeline/data/map-items.ts`
- Test: `apps/web/src/components/timeline/data/map-items.test.ts`

**Interfaces:**
- Consumes: `TimelineItem`, `TaskAssignee` from `@/data/timeline-items`; `Task`, `Milestone` from `@/hooks/use-tasks`.
- Produces: `mapProjectData(tasks: Task[], milestones: Milestone[], assigneeById?: Map<string, TaskAssignee>): { items: TimelineItem[]; undatedTaskRows: UndatedTaskRow[]; milestoneMarkers: MilestoneMarker[] }`. Dated items now carry `assignee` when the id resolves.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/components/timeline/data/map-items.test.ts` (inside the `describe`):

```ts
import type { TaskAssignee } from "@/data/timeline-items";

const maya: TaskAssignee = {
	id: "u_maya",
	name: "Maya Chen",
	avatarUrl: "https://example.com/maya.png",
};

it("resolves assignee from the assigneeById map", () => {
	const { items } = mapProjectData(
		[
			task({
				id: "t5",
				startDate: "2026-06-01",
				endDate: "2026-06-02",
				assigneeId: "u_maya",
			}),
		],
		[],
		new Map([["u_maya", maya]]),
	);
	expect(items[0].assignee).toEqual(maya);
});

it("leaves assignee undefined when the id is unknown or null", () => {
	const { items } = mapProjectData(
		[
			task({ id: "t6", startDate: "2026-06-01", endDate: "2026-06-02", assigneeId: "ghost" }),
			task({ id: "t7", startDate: "2026-06-01", endDate: "2026-06-02", assigneeId: null }),
		],
		[],
		new Map([["u_maya", maya]]),
	);
	expect(items[0].assignee).toBeUndefined();
	expect(items[1].assignee).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- map-items`
Expected: FAIL — `mapProjectData` ignores the 3rd arg / `assignee` is undefined.

- [ ] **Step 3: Implement assignee resolution**

In `apps/web/src/components/timeline/data/map-items.ts`, update the import and signature:

```ts
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
```

Change the function signature to accept the optional map:

```ts
export function mapProjectData(
	tasks: Task[],
	milestones: Milestone[],
	assigneeById?: Map<string, TaskAssignee>,
): {
	items: TimelineItem[];
	undatedTaskRows: UndatedTaskRow[];
	milestoneMarkers: MilestoneMarker[];
} {
```

Inside the dated-task branch, add the resolved assignee to the pushed item:

```ts
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
		assignee: t.assigneeId ? assigneeById?.get(t.assigneeId) : undefined,
	});
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test -- map-items`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/data/map-items.ts apps/web/src/components/timeline/data/map-items.test.ts
git commit -m "feat(web): resolve task assignee in mapProjectData"
```

---

### Task 2: Wire org members into `TimelineDataProvider`

**Files:**
- Modify: `apps/web/src/hooks/use-auth.tsx`
- Modify: `apps/web/src/components/timeline/data/context.tsx`

**Interfaces:**
- Consumes: `useSession`, `useOrgMembers` (existing in `use-auth.tsx`); `mapProjectData` (Task 1).
- Produces: `useActiveOrgMembers()` returning the same query result as `useOrgMembers` for the session's active organization. `TimelineDataProvider` now populates `item.assignee` for real projects.

- [ ] **Step 1: Add the `useActiveOrgMembers` helper**

In `apps/web/src/hooks/use-auth.tsx`, after `useOrgMembers`, add:

```ts
/**
 * Members of the session's active organization. Reuses the `useOrgMembers`
 * cache; returns an empty result until the session (and its
 * `activeOrganizationId`) has loaded.
 */
export function useActiveOrgMembers() {
	const { data: session } = useSession();
	const orgId = session?.session?.activeOrganizationId ?? undefined;
	return useOrgMembers(orgId);
}
```

- [ ] **Step 2: Build the assignee map in the provider**

In `apps/web/src/components/timeline/data/context.tsx`, add imports:

```ts
import type { TaskAssignee } from "@/data/timeline-items";
import { useActiveOrgMembers } from "@/hooks/use-auth";
```

Inside `TimelineDataProvider`, after the other query hooks, add:

```ts
const membersQuery = useActiveOrgMembers();

const assigneeById = useMemo(() => {
	const map = new Map<string, TaskAssignee>();
	for (const m of membersQuery.data?.members ?? []) {
		map.set(m.userId, {
			id: m.userId,
			name: m.user.name,
			avatarUrl: m.user.image ?? "",
		});
	}
	return map;
}, [membersQuery.data]);
```

- [ ] **Step 3: Pass the map into `mapProjectData`**

In the same file, update the `mapped` memo call and its deps:

```ts
return mapProjectData(
	tasksQuery.data ?? [],
	milestonesQuery.data ?? [],
	assigneeById,
);
```

Add `assigneeById` to that `useMemo` dependency array.

- [ ] **Step 4: Typecheck + run the existing data-context tests**

Run: `pnpm typecheck` (from repo root)
Expected: PASS (no type errors).
Run: `cd apps/web && pnpm test -- context`
Expected: PASS — existing tests still green (mock path unaffected; `assigneeById` is empty when no members).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-auth.tsx apps/web/src/components/timeline/data/context.tsx
git commit -m "feat(web): plumb active-org members into timeline assignees"
```

---

### Task 3: Greedy lane packing (pure)

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/pack-lanes.ts`
- Test: `apps/web/src/components/timeline/scheduler/pack-lanes.test.ts`

**Interfaces:**
- Consumes: `TimelineItem` from `@/data/timeline-items`; `ONE_DAY`, `startOfUtcDay` from `../units/make-units`; `RelativeTimeRangeOffset` from `../units/types`.
- Produces: `type PackedBar = { item: TimelineItem; range: RelativeTimeRangeOffset }`; `packLanes(tasks: TimelineItem[], today: number): PackedBar[][]` — each inner array is one lane; bars within a lane never overlap.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/timeline/scheduler/pack-lanes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { packLanes } from "./pack-lanes";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));

function bar(id: string, startDate: string, endDate: string): TimelineItem {
	return {
		id,
		kind: "task",
		name: id,
		parentId: null,
		startDate,
		endDate,
		color: "#000",
	};
}

describe("packLanes", () => {
	it("places non-overlapping tasks on a single lane", () => {
		const lanes = packLanes(
			[bar("a", "2026-06-01", "2026-06-03"), bar("b", "2026-06-05", "2026-06-07")],
			TODAY,
		);
		expect(lanes).toHaveLength(1);
		expect(lanes[0].map((p) => p.item.id)).toEqual(["a", "b"]);
	});

	it("splits overlapping tasks into separate lanes", () => {
		const lanes = packLanes(
			[bar("a", "2026-06-01", "2026-06-10"), bar("b", "2026-06-05", "2026-06-15")],
			TODAY,
		);
		expect(lanes).toHaveLength(2);
	});

	it("keeps adjacent (touching) ranges on the same lane", () => {
		// a ends 06-03 (inclusive → exclusive 06-04); b starts 06-04.
		const lanes = packLanes(
			[bar("a", "2026-06-01", "2026-06-03"), bar("b", "2026-06-04", "2026-06-06")],
			TODAY,
		);
		expect(lanes).toHaveLength(1);
	});

	it("returns an empty array for no tasks", () => {
		expect(packLanes([], TODAY)).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- pack-lanes`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packLanes`**

Create `apps/web/src/components/timeline/scheduler/pack-lanes.ts`:

```ts
import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";

export type PackedBar = {
	item: TimelineItem;
	range: RelativeTimeRangeOffset;
};

/** Own dates as an end-inclusive ms range relative to `today` (matches ownRange). */
function ownRange(item: TimelineItem, today: number): RelativeTimeRangeOffset {
	return {
		from: startOfUtcDay(Date.parse(item.startDate)) - today,
		to: startOfUtcDay(Date.parse(item.endDate)) - today + ONE_DAY,
	};
}

/**
 * Greedy interval packing. Tasks are sorted by start, then each is placed in the
 * first lane whose last bar ends on or before this bar's start; otherwise a new
 * lane opens. Bars within a lane never overlap.
 */
export function packLanes(
	tasks: TimelineItem[],
	today: number,
): PackedBar[][] {
	const bars: PackedBar[] = tasks
		.map((item) => ({ item, range: ownRange(item, today) }))
		.sort((a, b) => a.range.from - b.range.from);

	const lanes: PackedBar[][] = [];
	const laneEnds: number[] = [];

	for (const b of bars) {
		let placed = false;
		for (let i = 0; i < lanes.length; i++) {
			if (laneEnds[i] <= b.range.from) {
				lanes[i].push(b);
				laneEnds[i] = b.range.to;
				placed = true;
				break;
			}
		}
		if (!placed) {
			lanes.push([b]);
			laneEnds.push(b.range.to);
		}
	}

	return lanes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test -- pack-lanes`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/pack-lanes.ts apps/web/src/components/timeline/scheduler/pack-lanes.test.ts
git commit -m "feat(web): add scheduler greedy lane packing"
```

---

### Task 4: Assignee group rows (pure)

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/group-rows.ts`
- Test: `apps/web/src/components/timeline/scheduler/group-rows.test.ts`

**Interfaces:**
- Consumes: `TimelineItem`, `TaskAssignee` from `@/data/timeline-items`.
- Produces: `type GroupingMode = "assignee"`; `type GroupRow = { key: string; label: string; assignee?: TaskAssignee; tasks: TimelineItem[] }`; `buildGroupRows(items: TimelineItem[], mode: GroupingMode): GroupRow[]`. Assignee rows sorted by name; an "Unassigned" row (key `"unassigned"`) is appended last only when it has tasks. Parent tasks (with children) and milestones are excluded.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/timeline/scheduler/group-rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows } from "./group-rows";

const maya: TaskAssignee = { id: "u_maya", name: "Maya Chen", avatarUrl: "" };
const leo: TaskAssignee = { id: "u_leo", name: "Leo Martins", avatarUrl: "" };

function item(partial: Partial<TimelineItem>): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
		...partial,
	};
}

describe("buildGroupRows", () => {
	it("groups tasks by assignee, sorted by name, unassigned last", () => {
		const rows = buildGroupRows(
			[
				item({ id: "a", assignee: maya }),
				item({ id: "b", assignee: leo }),
				item({ id: "c" }),
			],
			"assignee",
		);
		expect(rows.map((r) => r.key)).toEqual(["u_leo", "u_maya", "unassigned"]);
		expect(rows[2].label).toBe("Unassigned");
		expect(rows[0].tasks.map((t) => t.id)).toEqual(["b"]);
	});

	it("omits the unassigned row when every task has an assignee", () => {
		const rows = buildGroupRows([item({ id: "a", assignee: maya })], "assignee");
		expect(rows.map((r) => r.key)).toEqual(["u_maya"]);
	});

	it("excludes parent tasks (those with children) and milestones", () => {
		const rows = buildGroupRows(
			[
				item({ id: "parent", assignee: maya }),
				item({ id: "child", parentId: "parent", assignee: maya }),
				item({ id: "ms", kind: "milestone", assignee: maya }),
			],
			"assignee",
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].tasks.map((t) => t.id)).toEqual(["child"]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- group-rows`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildGroupRows`**

Create `apps/web/src/components/timeline/scheduler/group-rows.ts`:

```ts
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";

export type GroupingMode = "assignee";

export type GroupRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	tasks: TimelineItem[];
};

const UNASSIGNED_KEY = "unassigned";

/**
 * Bucket schedulable tasks into rows. Launch mode: one row per assignee (sorted
 * by name) plus a trailing "Unassigned" row. Only leaf, non-milestone tasks are
 * included — parent containers and milestones are dropped.
 */
export function buildGroupRows(
	items: TimelineItem[],
	_mode: GroupingMode,
): GroupRow[] {
	const parentIds = new Set(
		items.map((i) => i.parentId).filter((id): id is string => id !== null),
	);
	const schedulable = items.filter(
		(i) => i.kind === "task" && !parentIds.has(i.id),
	);

	const byKey = new Map<string, GroupRow>();
	for (const task of schedulable) {
		const a = task.assignee;
		const key = a?.id ?? UNASSIGNED_KEY;
		const existing = byKey.get(key);
		if (existing) {
			existing.tasks.push(task);
		} else {
			byKey.set(key, {
				key,
				label: a?.name ?? "Unassigned",
				assignee: a,
				tasks: [task],
			});
		}
	}

	const unassigned = byKey.get(UNASSIGNED_KEY);
	byKey.delete(UNASSIGNED_KEY);

	const rows = [...byKey.values()].sort((x, y) =>
		x.label.localeCompare(y.label),
	);
	if (unassigned) rows.push(unassigned);
	return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test -- group-rows`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/group-rows.ts apps/web/src/components/timeline/scheduler/group-rows.test.ts
git commit -m "feat(web): add scheduler assignee group rows"
```

---

### Task 5: Row metrics + `layoutScheduler` orchestrator (pure)

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/row-metrics.ts`
- Create: `apps/web/src/components/timeline/scheduler/layout.ts`
- Test: `apps/web/src/components/timeline/scheduler/layout.test.ts`

**Interfaces:**
- Consumes: `buildGroupRows`, `GroupingMode`, `GroupRow` (Task 4); `packLanes`, `PackedBar` (Task 3); `TimelineItem`, `TaskAssignee` from `@/data/timeline-items`.
- Produces:
  - `row-metrics.ts`: `LANE_HEIGHT = 32`, `LANE_PADDING = 4`, `GROUP_PADDING = 8`; `groupHeight(laneCount: number): number = Math.max(laneCount, 1) * LANE_HEIGHT + GROUP_PADDING * 2`.
  - `layout.ts`: `type SchedulerRow = { key: string; label: string; assignee?: TaskAssignee; top: number; height: number; lanes: PackedBar[][] }`; `layoutScheduler(items: TimelineItem[], mode: GroupingMode, today: number): { rows: SchedulerRow[]; totalHeight: number }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/scheduler/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { layoutScheduler } from "./layout";
import { GROUP_PADDING, LANE_HEIGHT } from "./row-metrics";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));
const maya: TaskAssignee = { id: "u_maya", name: "Maya Chen", avatarUrl: "" };

function item(partial: Partial<TimelineItem>): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
		assignee: maya,
		...partial,
	};
}

describe("layoutScheduler", () => {
	it("stacks tops and sums total height across rows", () => {
		const { rows, totalHeight } = layoutScheduler(
			[
				item({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" }),
				item({ id: "b", startDate: "2026-06-05", endDate: "2026-06-15" }),
			],
			"assignee",
			TODAY,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].top).toBe(0);
		// 2 overlapping tasks → 2 lanes.
		expect(rows[0].lanes).toHaveLength(2);
		const expectedHeight = 2 * LANE_HEIGHT + GROUP_PADDING * 2;
		expect(rows[0].height).toBe(expectedHeight);
		expect(totalHeight).toBe(expectedHeight);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- scheduler/layout`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `row-metrics.ts`**

Create `apps/web/src/components/timeline/scheduler/row-metrics.ts`:

```ts
/** Vertical pixels for one packed sub-lane (bar + gap). */
export const LANE_HEIGHT = 32;
/** Padding trimmed off top/bottom of a bar within its lane. */
export const LANE_PADDING = 4;
/** Padding above/below the stack of lanes inside a group row. */
export const GROUP_PADDING = 8;

/** Total height of a group row holding `laneCount` lanes (min one lane). */
export const groupHeight = (laneCount: number): number =>
	Math.max(laneCount, 1) * LANE_HEIGHT + GROUP_PADDING * 2;
```

- [ ] **Step 4: Implement `layout.ts`**

Create `apps/web/src/components/timeline/scheduler/layout.ts`:

```ts
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows, type GroupingMode } from "./group-rows";
import { type PackedBar, packLanes } from "./pack-lanes";
import { groupHeight } from "./row-metrics";

export type SchedulerRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	top: number;
	height: number;
	lanes: PackedBar[][];
};

/**
 * Compose grouping + lane packing + variable-height stacking into positioned
 * rows. `top` is the cumulative pixel offset of each row; `totalHeight` is the
 * full stacked height for the scroll container.
 */
export function layoutScheduler(
	items: TimelineItem[],
	mode: GroupingMode,
	today: number,
): { rows: SchedulerRow[]; totalHeight: number } {
	const groups = buildGroupRows(items, mode);
	const rows: SchedulerRow[] = [];
	let top = 0;
	for (const g of groups) {
		const lanes = packLanes(g.tasks, today);
		const height = groupHeight(lanes.length);
		rows.push({
			key: g.key,
			label: g.label,
			assignee: g.assignee,
			top,
			height,
			lanes,
		});
		top += height;
	}
	return { rows, totalHeight: top };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- scheduler/layout`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/row-metrics.ts apps/web/src/components/timeline/scheduler/layout.ts apps/web/src/components/timeline/scheduler/layout.test.ts
git commit -m "feat(web): add scheduler row layout orchestrator"
```

---

### Task 6: `SchedulerLanes` read-only bars renderer

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`

**Interfaces:**
- Consumes: `SchedulerRow` (Task 5); `useTimelineController` from `../controller/context`; `useHorizontalPercentageOffset` from `../controller/hooks`; `rangeVisibility`, `Geometry` from `../controller/geometry`; `MIN_BAR_WIDTH_PX` from `../constants`; `useRowSelection` from `../selection/context`; `useTimelineData` from `../data/context`; `LANE_HEIGHT`, `LANE_PADDING`, `GROUP_PADDING` from `./row-metrics`; `cn` from `@orbit/shared`.
- Produces: `default export function SchedulerLanes({ rows, totalHeight }: { rows: SchedulerRow[]; totalHeight: number })`. Renders positioned, read-only, selectable bars, plus an inline "Couldn't load tasks" banner on error (mirrors `ItemsLayer`). Off-screen bars are skipped (no flyout in this pass).

- [ ] **Step 1: Implement the component**

Create `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`:

```tsx
import { cn } from "@orbit/shared";
import { MIN_BAR_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { type Geometry, rangeVisibility } from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { useTimelineData } from "../data/context";
import { useRowSelection } from "../selection/context";
import type { SchedulerRow } from "./layout";
import { GROUP_PADDING, LANE_HEIGHT, LANE_PADDING } from "./row-metrics";

export default function SchedulerLanes({
	rows,
	totalHeight,
}: {
	rows: SchedulerRow[];
	totalHeight: number;
}) {
	const { offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { isSelected, toggle, hoveredId, setHovered } = useRowSelection();
	const { isError } = useTimelineData();

	if (viewportWidth <= 0) return null;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };
	const barHeight = LANE_HEIGHT - LANE_PADDING * 2;
	const minWidthPercent = (MIN_BAR_WIDTH_PX / viewportWidth) * 100;

	return (
		<div
			data-testid="scheduler-lanes"
			className="pointer-events-none relative w-full"
			style={{ height: totalHeight }}
		>
			{isError && (
				<div
					data-testid="scheduler-error"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					Couldn't load tasks
				</div>
			)}
			{rows.map((row) =>
				row.lanes.map((lane, laneIndex) =>
					lane.map(({ item, range }) => {
						if (rangeVisibility(range.from, range.to, geom) !== "visible") {
							return null;
						}
						const left = getPercentageOffset(range.from);
						const right = getPercentageOffset(range.to);
						if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
						const width = Math.max(right - left, minWidthPercent);
						const top =
							row.top + GROUP_PADDING + laneIndex * LANE_HEIGHT + LANE_PADDING;
						const selected = isSelected(item.id);
						const hovered = hoveredId === item.id;
						return (
							<button
								type="button"
								key={item.id}
								data-testid="scheduler-bar"
								data-selected={selected}
								title={item.name}
								onMouseEnter={() => setHovered(item.id)}
								onMouseLeave={() => setHovered(null)}
								onClick={() => toggle(item.id)}
								style={{
									left: `${left}%`,
									width: `${width}%`,
									top,
									height: barHeight,
									backgroundColor: item.color,
								}}
								className={cn(
									"pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm",
									(selected || hovered) && "ring-2 ring-primary",
								)}
							>
								{item.progress !== undefined && (
									<span
										className="absolute inset-y-0 left-0 bg-black/20"
										style={{ width: `${item.progress}%` }}
									/>
								)}
								<span className="relative truncate">{item.name}</span>
							</button>
						);
					}),
				),
			)}
		</div>
	);
}
```

- [ ] **Step 2: Confirm `useRowSelection` exposes `toggle`, `isSelected`, `hoveredId`, `setHovered`**

Run: `grep -n "toggle\|isSelected\|hoveredId\|setHovered" apps/web/src/components/timeline/selection/context.tsx`
Expected: all four appear in the context value. If `toggle` has a different name, use the actual single-item toggle method shown there.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck` (repo root)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx
git commit -m "feat(web): add scheduler read-only lanes renderer"
```

---

### Task 7: `SchedulerLayout` + wire into `SchedulerView`

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Modify: `apps/web/src/components/timeline/scheduler-view.tsx`

**Interfaces:**
- Consumes: `TimelineProvider`, `useTimelineController` from `../controller/context`; `layoutScheduler`, `SchedulerRow` from `./layout`; `SchedulerLanes` (Task 6); `useTimelineData` from `../data/context`; `TimeUnitsBar`, `TimelineGrid`, `NowLine`, `MilestoneMarkers`, `ZoomControl`, `TimelineScrollbar`, `usePan`, `useResizableDivider`, `CustomizeMenu` (existing); `RowSelectionProvider` from `../selection/context`; `usePreferences` from `@/hooks/use-preferences`; `UserAvatar` from `@orbit/ui/custom/user-avatar`; `msPerViewport` from `../controller/geometry`.
- Produces: `SchedulerView` renders the full scheduler (toolbar with pan/Today/zoom/Customize, header band, left assignee column, packed lanes) inside a `TimelineProvider` + `RowSelectionProvider`.

- [ ] **Step 1: Implement `SchedulerLayout`**

Create `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`. This mirrors `SplitLayoutInner` (`../layout/split-layout.tsx`) but drives variable-height group rows and a read-only body:

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef } from "react";
import { UserAvatar } from "@orbit/ui/custom/user-avatar";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import { msPerViewport } from "../controller/geometry";
import CustomizeMenu from "../customize-menu";
import { useTimelineData } from "../data/context";
import TimeUnitsBar from "../header/time-units-bar";
import { useResizableDivider } from "../layout/use-resizable-divider";
import MilestoneMarkers from "../milestone-markers";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { RowSelectionProvider, useRowSelection } from "../selection/context";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";
import { layoutScheduler, type SchedulerRow } from "./layout";
import SchedulerLanes from "./scheduler-lanes";

const PAN_STEP = 0.25;

function isTypingTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName;
	return (
		tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
	);
}

function GroupHeader({ row }: { row: SchedulerRow }) {
	return (
		<div
			data-testid="scheduler-group-header"
			className="flex items-center gap-2 border-b border-border px-3"
			style={{ height: row.height }}
		>
			<UserAvatar
				size="sm"
				colorSeed={row.assignee?.id ?? row.key}
				placeholder={row.label}
				avatarUrl={row.assignee?.avatarUrl}
			/>
			<span className="min-w-0 flex-1 truncate text-sm font-medium">{row.label}</span>
			<span className="shrink-0 text-xs text-muted-foreground">
				{row.lanes.reduce((n, lane) => n + lane.length, 0)}
			</span>
		</div>
	);
}

function SchedulerLayoutInner({ viewSwitch }: { viewSwitch?: ReactNode }) {
	const {
		setViewportWidth,
		scrollToToday,
		setOffsetMs,
		zoomLevel,
		viewportWidth,
		viewportRef,
		scrollContainerRef,
		today,
	} = useTimelineController();
	const { tableWidth, collapsed, toggleCollapsed, onDividerPointerDown } =
		useResizableDivider();
	const { onWheel } = usePan();
	const { clear } = useRowSelection();
	const { items } = useTimelineData();

	const { rows, totalHeight } = useMemo(
		() => layoutScheduler(items, "assignee", today),
		[items, today],
	);

	const scrollRef = scrollContainerRef;
	const { width = 0 } = useResizeObserver({
		ref: viewportRef as RefObject<HTMLDivElement>,
	});
	useEffect(() => {
		setViewportWidth(width);
	}, [width, setViewportWidth]);

	const panViewports = (fraction: number) => {
		setOffsetMs(
			(prev) =>
				prev +
				fraction * msPerViewport({ offsetMs: prev, zoom: zoomLevel, viewportWidth }),
		);
	};
	const panRef = useRef(panViewports);
	panRef.current = panViewports;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return;
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				panRef.current(-PAN_STEP);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				panRef.current(PAN_STEP);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isTypingTarget(e.target)) clear();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [clear]);

	return (
		<div className="relative flex h-full flex-col" data-testid="scheduler-view">
			{/* toolbar */}
			<div className="flex items-center justify-between border-b border-border p-2">
				<div className="flex items-center gap-1.5" />
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						aria-label="Scroll to earlier dates"
						onClick={() => panViewports(-PAN_STEP)}
						className="rounded-md border border-border p-1 hover:bg-accent"
					>
						<ChevronLeft className="size-4" />
					</button>
					<button
						type="button"
						onClick={scrollToToday}
						className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
					>
						Today
					</button>
					<button
						type="button"
						aria-label="Scroll to later dates"
						onClick={() => panViewports(PAN_STEP)}
						className="rounded-md border border-border p-1 hover:bg-accent"
					>
						<ChevronRight className="size-4" />
					</button>
					<ZoomControl />
					<CustomizeMenu viewSwitch={viewSwitch} />
				</div>
			</div>

			{/* split region */}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{/* header band */}
				<div className="relative z-20 flex h-12 shrink-0 border-b border-border">
					<div
						className="relative z-30 shrink-0 overflow-hidden border-r border-border bg-muted/40"
						style={{ width: collapsed ? 0 : tableWidth }}
					/>
					<div className="relative flex-1">
						<TimeUnitsBar />
					</div>
				</div>

				{/* body */}
				<div className="relative flex-1 overflow-hidden">
					<div
						className="absolute inset-y-0"
						style={{ left: collapsed ? 0 : tableWidth, right: 0 }}
					>
						<TimelineGrid />
						<NowLine />
						<MilestoneMarkers />
					</div>
					<div
						ref={scrollRef}
						className="absolute inset-0 overflow-y-auto overflow-x-hidden"
					>
						<div className="flex min-h-full">
							{!collapsed && (
								<div
									data-testid="scheduler-group-column"
									className="relative z-30 min-h-full shrink-0 overflow-hidden border-r border-border bg-background-primary"
									style={{ width: tableWidth }}
								>
									{rows.map((row) => (
										<GroupHeader key={row.key} row={row} />
									))}
								</div>
							)}
							<div
								ref={viewportRef}
								className="relative flex-1 touch-none select-none"
								onWheel={onWheel}
							>
								<SchedulerLanes rows={rows} totalHeight={totalHeight} />
							</div>
						</div>
					</div>

					{!collapsed && (
						<div
							data-testid="scheduler-split-divider"
							onPointerDown={onDividerPointerDown}
							className="absolute inset-y-0 z-40 w-3 -translate-x-1/2 cursor-col-resize hover:bg-border"
							style={{ left: tableWidth }}
						/>
					)}
				</div>

				{/* footer scrollbar */}
				<div className="flex shrink-0">
					{!collapsed && <div className="shrink-0" style={{ width: tableWidth }} />}
					<div className="relative flex-1">
						<TimelineScrollbar />
					</div>
				</div>
			</div>
		</div>
	);
}

export default function SchedulerLayout({ viewSwitch }: { viewSwitch?: ReactNode }) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<RowSelectionProvider>
				<SchedulerLayoutInner viewSwitch={viewSwitch} />
			</RowSelectionProvider>
		</TimelineProvider>
	);
}
```

- [ ] **Step 2: Replace the placeholder body in `scheduler-view.tsx`**

Overwrite `apps/web/src/components/timeline/scheduler-view.tsx`. Mirror the
loading/empty gating that `TimelineView` applies before rendering its body
(error is surfaced inline by `SchedulerLanes`):

```tsx
import type { ReactNode } from "react";
import { useTimelineData } from "./data/context";
import SchedulerLayout from "./scheduler/scheduler-layout";
import TimelineEmptyState from "./timeline-empty-state";
import TimelineSkeleton from "./timeline-skeleton";

/**
 * Scheduler layout — one row per assignee, tasks packed into stacked sub-lanes.
 * The Customize menu carries the view switcher so the user can switch back.
 */
export default function SchedulerView({
	viewSwitch,
}: {
	viewSwitch?: ReactNode;
}) {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();

	const isLoadingProject = !!projectId && isLoading;
	const isEmptyProject =
		!!projectId &&
		!isLoading &&
		!isError &&
		items.length === 0 &&
		undatedTaskRows.length === 0;

	if (isLoadingProject) return <TimelineSkeleton />;
	if (isEmptyProject) return <TimelineEmptyState projectId={projectId} />;

	return <SchedulerLayout viewSwitch={viewSwitch} />;
}
```

- [ ] **Step 3: Verify `useResizableDivider` and `usePreferences` signatures**

Run: `grep -n "export function useResizableDivider\|tableWidth\|collapsed\|toggleCollapsed\|onDividerPointerDown" apps/web/src/components/timeline/layout/use-resizable-divider.ts`
Expected: the hook returns `{ tableWidth, collapsed, toggleCollapsed, onDividerPointerDown }`. If it requires an `initialTableWidth` arg, call `useResizableDivider()` with no arg (default) as written.
Run: `grep -n "weekStart\|export function usePreferences" apps/web/src/hooks/use-preferences.ts`
Expected: `usePreferences().data?.weekStart` exists.

- [ ] **Step 4: Typecheck + build the web app**

Run: `pnpm typecheck` (repo root)
Expected: PASS.
Run: `cd apps/web && pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler-view.tsx
git commit -m "feat(web): render scheduler view with assignee lanes"
```

---

### Task 8: Scheduler integration test

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`

**Interfaces:**
- Consumes: `SchedulerView`; the same test harness/providers used by `apps/web/src/components/timeline/timeline-view.test.tsx` (copy its render wrapper, `TimelineDataProvider` + `QueryClientProvider`, and any mocks it sets up).

- [ ] **Step 1: Inspect the existing timeline test harness**

Run: `sed -n '1,60p' apps/web/src/components/timeline/timeline-view.test.tsx`
Expected: note how it wraps the component (QueryClient, TimelineDataProvider without `projectId` → mock data) and how it queries the DOM. Reuse that exact wrapper below.

- [ ] **Step 2: Write the integration test**

Create `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`. Adapt the wrapper from Step 1; the intent:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineDataProvider } from "../data/context";
import SchedulerView from "../scheduler-view";

function renderScheduler() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={qc}>
			<TimelineDataProvider>
				<SchedulerView />
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
}

describe("SchedulerView", () => {
	it("renders per-assignee group headers from mock data", async () => {
		renderScheduler();
		const headers = await screen.findAllByTestId("scheduler-group-header");
		expect(headers.length).toBeGreaterThan(0);
		// Mock data assigns tasks to named users.
		expect(screen.getByText("Maya Chen")).toBeInTheDocument();
	});

	it("renders packed task bars", async () => {
		renderScheduler();
		const bars = await screen.findAllByTestId("scheduler-bar");
		expect(bars.length).toBeGreaterThan(0);
	});
});
```

Note: `SchedulerLanes` renders bars only once `viewportWidth > 0`. If the jsdom container reports width 0 (like the timeline tests), follow whatever pattern `timeline-view.test.tsx` / `items-layer.test.tsx` use to give the viewport a width (mocking `useResizeObserver` or `getBoundingClientRect`). If those tests avoid asserting on rendered bars for that reason, drop the second test and assert on `scheduler-group-header` + the `Maya Chen` label only.

- [ ] **Step 3: Run the test**

Run: `cd apps/web && pnpm test -- scheduler-view`
Expected: PASS.

- [ ] **Step 4: Run the full timeline test suite for regressions**

Run: `cd apps/web && pnpm test -- timeline`
Expected: PASS — no existing timeline tests regressed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "test(web): add scheduler view integration test"
```

---

## Final verification

- [ ] Run `pnpm check` (repo root) — Biome lint/format clean.
- [ ] Run `pnpm typecheck` (repo root) — no type errors.
- [ ] Run `cd apps/web && pnpm test` — full web suite green.
- [ ] Manually: open a project, switch to scheduler via the Customize menu, confirm assignee rows, overlapping bars stack, Today/pan/zoom work, milestones show as markers.
