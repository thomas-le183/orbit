# Timeline Items: Hierarchy + Drag/Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the timeline from flat tasks to a task hierarchy (parent tasks wrapping subtasks) plus milestones, and make bars draggable (move) and resizable, snapping to whole UTC days.

**Architecture:** A unified `TimelineItem[]` (flat list + `parentId`) is turned into render rows + parent container rects by a pure `layoutItems()` pass (rollup-derived parent spans). A `useTimelineItems()` hook owns in-memory state behind an `updateItem`/`moveDays` seam (future backend swap). `items-layer.tsx` renders rows on the existing `ms → %` mapping; a `useBarInteraction()` hook converts pointer drags to day-snapped edits with a live draft. Replaces `task-bars.tsx`.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, Tailwind v4, lucide-react, `cn()` from `@orbit/shared`.

## Global Constraints

- Package manager: `pnpm` (Node >=24). Run web tests from `apps/web`: `pnpm test -- --run`.
- All time is **ms-offset-from-today**; `today = startOfUtcDay(Date.now())`. Date math is UTC.
- Snapping granularity: **whole UTC day** (`ONE_DAY = 86_400_000`).
- Reuse existing primitives: `startOfUtcDay`, `ONE_DAY` from `units/make-units.ts`; `PX_PER_DAY`, `pxPerMs`, `rangeVisibility`, `type Geometry` from `controller/geometry.ts`; `type RelativeTimeRangeOffset` from `units/types.ts`; `getPercentageOffset` from `controller/hooks.ts`; `scrollToMs` from the controller.
- TypeScript: `camelCase` vars, `PascalCase` types/components, no `any`.
- Styling: Tailwind classes via `cn()`; conditional merges through `cn()`.
- Lint/format: `pnpm biome check --write <files>` before each commit; `pnpm typecheck` clean.
- TDD: write the failing test, see it fail, implement, see it pass, commit. One logical change per commit.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/data/timeline-items.ts` (create) | `TimelineItem` type + seed (parents, subtasks, milestones) |
| `apps/web/src/components/timeline/units/make-units.ts` (modify) | add `toUtcDateString(ts)` date helper |
| `apps/web/src/components/timeline/controller/layout.ts` (create) | pure: tree → render rows + container rects + rollup |
| `apps/web/src/components/timeline/use-timeline-items.ts` (create) | in-memory items state + `updateItem` / `moveDays` seam |
| `apps/web/src/components/timeline/use-bar-interaction.ts` (create) | pure px→day/move/resize helpers, then the gesture hook |
| `apps/web/src/components/timeline/items-layer.tsx` (create) | renders rows: containers, task bars, milestones, fly-outs, drag/resize |
| `apps/web/src/components/timeline/container/index.tsx` (modify) | render `<ItemsLayer />` in place of `<TaskBars />` |
| `apps/web/src/components/timeline/task-bars.tsx` (delete) | superseded by `items-layer.tsx` |
| `apps/web/src/components/timeline/task-bars.test.tsx` (delete) | superseded by `items-layer.test.tsx` |
| `apps/web/src/data/tasks.ts` (delete) | superseded by `timeline-items.ts` |

---

## Task 1: Unified data model + seed

**Files:**
- Create: `apps/web/src/data/timeline-items.ts`
- Test: `apps/web/src/data/timeline-items.test.ts`

**Interfaces:**
- Produces: `type TimelineItemKind = "task" | "milestone"`; `type TaskAssignee`; `type TaskStatus`; `type TimelineItem`; `const timelineItems: TimelineItem[]`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/data/timeline-items.test.ts
import { describe, expect, it } from "vitest";
import { type TimelineItem, timelineItems } from "./timeline-items";

const byId = new Map<string, TimelineItem>(timelineItems.map((i) => [i.id, i]));

describe("timelineItems seed", () => {
	it("has unique ids", () => {
		expect(byId.size).toBe(timelineItems.length);
	});

	it("every parentId resolves to an existing task", () => {
		for (const item of timelineItems) {
			if (item.parentId === null) continue;
			const parent = byId.get(item.parentId);
			expect(parent, `${item.id} parent`).toBeDefined();
			expect(parent?.kind).toBe("task");
		}
	});

	it("milestones are zero-duration (start === end)", () => {
		for (const item of timelineItems.filter((i) => i.kind === "milestone")) {
			expect(item.startDate).toBe(item.endDate);
		}
	});

	it("includes at least one parent task with children and one milestone", () => {
		const parentIds = new Set(
			timelineItems.map((i) => i.parentId).filter(Boolean),
		);
		expect(parentIds.size).toBeGreaterThan(0);
		expect(timelineItems.some((i) => i.kind === "milestone")).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run timeline-items.test.ts`
Expected: FAIL — cannot resolve `./timeline-items`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/data/timeline-items.ts
export type TimelineItemKind = "task" | "milestone";

export type TaskStatus =
	| "todo"
	| "in_progress"
	| "in_review"
	| "done"
	| "blocked";

export type TaskAssignee = {
	id: string;
	name: string;
	avatarUrl: string;
};

export type TimelineItem = {
	id: string;
	kind: TimelineItemKind;
	name: string;
	/** null = top-level; otherwise the id of the parent task. */
	parentId: string | null;
	/** ISO YYYY-MM-DD. For milestones, the single date. */
	startDate: string;
	/** ISO YYYY-MM-DD, inclusive. For milestones, equals startDate. */
	endDate: string;
	/** 0–100, leaf tasks only. */
	progress?: number;
	color: string;
	assignee?: TaskAssignee;
	status?: TaskStatus;
};

const assignees: Record<string, TaskAssignee> = {
	maya: { id: "u_maya", name: "Maya Chen", avatarUrl: "https://i.pravatar.cc/64?u=maya" },
	leo: { id: "u_leo", name: "Leo Martins", avatarUrl: "https://i.pravatar.cc/64?u=leo" },
	priya: { id: "u_priya", name: "Priya Nair", avatarUrl: "https://i.pravatar.cc/64?u=priya" },
	noah: { id: "u_noah", name: "Noah Becker", avatarUrl: "https://i.pravatar.cc/64?u=noah" },
	sofia: { id: "u_sofia", name: "Sofia Rossi", avatarUrl: "https://i.pravatar.cc/64?u=sofia" },
};

// Parent tasks carry placeholder dates; their rendered span is derived from children.
export const timelineItems: TimelineItem[] = [
	{ id: "ms-kickoff", kind: "milestone", name: "Kickoff", parentId: null, startDate: "2026-06-01", endDate: "2026-06-01", color: "#0ea5e9" },

	{ id: "p-platform", kind: "task", name: "Core Platform", parentId: null, startDate: "2026-06-01", endDate: "2026-09-18", color: "#6366f1" },
	{ id: "t-design", kind: "task", name: "Design system foundations", parentId: "p-platform", startDate: "2026-06-15", endDate: "2026-06-30", progress: 65, color: "#ec4899", status: "in_progress", assignee: assignees.sofia },
	{ id: "t-api", kind: "task", name: "API schema & data model", parentId: "p-platform", startDate: "2026-06-22", endDate: "2026-07-10", progress: 40, color: "#f59e0b", status: "in_progress", assignee: assignees.leo },
	{ id: "t-axis", kind: "task", name: "Timeline calendar axis", parentId: "p-platform", startDate: "2026-06-26", endDate: "2026-07-17", progress: 25, color: "#10b981", status: "in_progress", assignee: assignees.noah },
	{ id: "t-auth", kind: "task", name: "Authentication & onboarding", parentId: "p-platform", startDate: "2026-07-13", endDate: "2026-07-31", progress: 0, color: "#3b82f6", status: "todo", assignee: assignees.leo },
	{ id: "ms-beta", kind: "milestone", name: "Beta launch", parentId: "p-platform", startDate: "2026-09-14", endDate: "2026-09-14", color: "#0ea5e9" },

	{ id: "p-billing", kind: "task", name: "Billing & Payments", parentId: null, startDate: "2026-07-20", endDate: "2026-09-30", color: "#ef4444" },
	{ id: "t-billing", kind: "task", name: "Billing integration", parentId: "p-billing", startDate: "2026-07-20", endDate: "2026-08-14", progress: 0, color: "#ef4444", status: "blocked", assignee: assignees.maya },
	{ id: "t-invoicing", kind: "task", name: "Invoicing & receipts", parentId: "p-billing", startDate: "2026-08-10", endDate: "2026-09-05", progress: 0, color: "#f97316", status: "todo", assignee: assignees.priya },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --run timeline-items.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
pnpm biome check --write apps/web/src/data/timeline-items.ts apps/web/src/data/timeline-items.test.ts
git add apps/web/src/data/timeline-items.ts apps/web/src/data/timeline-items.test.ts
git commit -m "feat(timeline): add unified TimelineItem model + seed"
```

---

## Task 2: Add `toUtcDateString` date helper

**Files:**
- Modify: `apps/web/src/components/timeline/units/make-units.ts` (after `startOfUtcDay`, ~line 16)
- Test: `apps/web/src/components/timeline/units/make-units.test.ts` (append)

**Interfaces:**
- Consumes: `startOfUtcDay` (existing).
- Produces: `toUtcDateString(ts: number): string` — UTC `YYYY-MM-DD` for the day containing `ts`.

- [ ] **Step 1: Write the failing test** (append to `make-units.test.ts`)

```ts
import { toUtcDateString } from "./make-units";

describe("toUtcDateString", () => {
	it("formats the UTC day as YYYY-MM-DD", () => {
		expect(toUtcDateString(Date.parse("2026-06-27T13:45:00Z"))).toBe(
			"2026-06-27",
		);
	});

	it("is stable across the day (uses start of UTC day)", () => {
		const a = toUtcDateString(Date.parse("2026-01-01T00:00:00Z"));
		const b = toUtcDateString(Date.parse("2026-01-01T23:59:59Z"));
		expect(a).toBe("2026-01-01");
		expect(b).toBe("2026-01-01");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run make-units.test.ts`
Expected: FAIL — `toUtcDateString` is not exported.

- [ ] **Step 3: Write minimal implementation** (add after `startOfUtcDay` in `make-units.ts`)

```ts
/** UTC YYYY-MM-DD for the day containing `ts`. */
export const toUtcDateString = (ts: number): string =>
	new Date(startOfUtcDay(ts)).toISOString().slice(0, 10);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --run make-units.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
pnpm biome check --write apps/web/src/components/timeline/units/make-units.ts apps/web/src/components/timeline/units/make-units.test.ts
git add apps/web/src/components/timeline/units/make-units.ts apps/web/src/components/timeline/units/make-units.test.ts
git commit -m "feat(timeline): add toUtcDateString date helper"
```

---

## Task 3: Pure layout pass (`layout.ts`)

**Files:**
- Create: `apps/web/src/components/timeline/controller/layout.ts`
- Test: `apps/web/src/components/timeline/controller/layout.test.ts`

**Interfaces:**
- Consumes: `TimelineItem` (Task 1); `startOfUtcDay`, `ONE_DAY` (`units/make-units`); `RelativeTimeRangeOffset` (`units/types`).
- Produces:
  - `type RenderRow = { item: TimelineItem; depth: number; range: RelativeTimeRangeOffset; rowIndex: number; isParent: boolean }`
  - `type ContainerRect = { parentId: string; range: RelativeTimeRangeOffset; rowStart: number; rowEnd: number }`
  - `function layoutItems(items: TimelineItem[], today: number): { rows: RenderRow[]; containers: ContainerRect[] }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/components/timeline/controller/layout.test.ts
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { layoutItems } from "./layout";

const ONE_DAY = 86_400_000;
const today = startOfUtcDay(Date.parse("2026-06-01"));
const dayOffset = (iso: string) => startOfUtcDay(Date.parse(iso)) - today;

const items: TimelineItem[] = [
	{ id: "p", kind: "task", name: "Parent", parentId: null, startDate: "2026-06-01", endDate: "2026-06-02", color: "#000" },
	{ id: "c1", kind: "task", name: "Child 1", parentId: "p", startDate: "2026-06-03", endDate: "2026-06-05", color: "#111" },
	{ id: "c2", kind: "task", name: "Child 2", parentId: "p", startDate: "2026-06-10", endDate: "2026-06-12", color: "#222" },
	{ id: "m", kind: "milestone", name: "Mile", parentId: null, startDate: "2026-06-20", endDate: "2026-06-20", color: "#333" },
];

describe("layoutItems", () => {
	it("assigns sequential rowIndex in document (depth-first) order", () => {
		const { rows } = layoutItems(items, today);
		expect(rows.map((r) => r.item.id)).toEqual(["p", "c1", "c2", "m"]);
		expect(rows.map((r) => r.rowIndex)).toEqual([0, 1, 2, 3]);
		expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0]);
	});

	it("derives a parent's range from its children (rollup), ignoring its own dates", () => {
		const { rows } = layoutItems(items, today);
		const parent = rows.find((r) => r.item.id === "p");
		expect(parent?.isParent).toBe(true);
		// min child start (c1 = Jun 3) .. max child end (c2 = Jun 12, inclusive → +1 day)
		expect(parent?.range.from).toBe(dayOffset("2026-06-03"));
		expect(parent?.range.to).toBe(dayOffset("2026-06-12") + ONE_DAY);
	});

	it("gives a milestone a one-day hit range starting at its date", () => {
		const { rows } = layoutItems(items, today);
		const mile = rows.find((r) => r.item.id === "m");
		expect(mile?.range.from).toBe(dayOffset("2026-06-20"));
		expect(mile?.range.to).toBe(dayOffset("2026-06-20") + ONE_DAY);
		expect(mile?.isParent).toBe(false);
	});

	it("emits a container rect spanning the parent's derived range and its rows", () => {
		const { containers } = layoutItems(items, today);
		expect(containers).toHaveLength(1);
		const c = containers[0];
		expect(c.parentId).toBe("p");
		expect(c.rowStart).toBe(0); // parent row
		expect(c.rowEnd).toBe(2); // last descendant row (c2)
		expect(c.range.from).toBe(dayOffset("2026-06-03"));
		expect(c.range.to).toBe(dayOffset("2026-06-12") + ONE_DAY);
	});

	it("treats a childless task as a leaf using its own dates", () => {
		const { rows, containers } = layoutItems(
			[{ id: "solo", kind: "task", name: "Solo", parentId: null, startDate: "2026-06-04", endDate: "2026-06-06", color: "#000" }],
			today,
		);
		expect(rows[0].isParent).toBe(false);
		expect(rows[0].range.from).toBe(dayOffset("2026-06-04"));
		expect(rows[0].range.to).toBe(dayOffset("2026-06-06") + ONE_DAY);
		expect(containers).toHaveLength(0);
	});

	it("returns empty rows/containers for empty input", () => {
		expect(layoutItems([], today)).toEqual({ rows: [], containers: [] });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run layout.test.ts`
Expected: FAIL — cannot resolve `./layout`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/components/timeline/controller/layout.ts
import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";

export type RenderRow = {
	item: TimelineItem;
	depth: number;
	range: RelativeTimeRangeOffset;
	rowIndex: number;
	isParent: boolean;
};

export type ContainerRect = {
	parentId: string;
	range: RelativeTimeRangeOffset;
	rowStart: number;
	rowEnd: number;
};

/** Own dates of a leaf/milestone as a ms range (end date inclusive → +1 day). */
function ownRange(item: TimelineItem, today: number): RelativeTimeRangeOffset {
	return {
		from: startOfUtcDay(Date.parse(item.startDate)) - today,
		to: startOfUtcDay(Date.parse(item.endDate)) - today + ONE_DAY,
	};
}

export function layoutItems(
	items: TimelineItem[],
	today: number,
): { rows: RenderRow[]; containers: ContainerRect[] } {
	const childrenOf = new Map<string | null, TimelineItem[]>();
	for (const item of items) {
		const key = item.parentId;
		const list = childrenOf.get(key) ?? [];
		list.push(item);
		childrenOf.set(key, list);
	}

	const rows: RenderRow[] = [];
	const containers: ContainerRect[] = [];

	const walk = (item: TimelineItem, depth: number): RelativeTimeRangeOffset => {
		const children = childrenOf.get(item.id) ?? [];
		const isParent = item.kind === "task" && children.length > 0;
		const rowIndex = rows.length;
		// Reserve the row now so children get later indices.
		const row: RenderRow = {
			item,
			depth,
			rowIndex,
			isParent,
			range: ownRange(item, today),
		};
		rows.push(row);

		if (!isParent) return row.range;

		let from = Number.POSITIVE_INFINITY;
		let to = Number.NEGATIVE_INFINITY;
		for (const child of children) {
			const childRange = walk(child, depth + 1);
			from = Math.min(from, childRange.from);
			to = Math.max(to, childRange.to);
		}
		row.range = { from, to };
		containers.push({
			parentId: item.id,
			range: row.range,
			rowStart: rowIndex,
			rowEnd: rows.length - 1,
		});
		return row.range;
	};

	for (const root of childrenOf.get(null) ?? []) walk(root, 0);

	return { rows, containers };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --run layout.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
pnpm biome check --write apps/web/src/components/timeline/controller/layout.ts apps/web/src/components/timeline/controller/layout.test.ts
git add apps/web/src/components/timeline/controller/layout.ts apps/web/src/components/timeline/controller/layout.test.ts
git commit -m "feat(timeline): add pure layoutItems (rollup + rows + containers)"
```

---

## Task 4: Pure interaction math (`use-bar-interaction.ts` helpers)

**Files:**
- Create: `apps/web/src/components/timeline/use-bar-interaction.ts`
- Test: `apps/web/src/components/timeline/use-bar-interaction.test.ts`

**Interfaces:**
- Consumes: `PX_PER_DAY` (`controller/geometry`); `ONE_DAY`, `toUtcDateString` (`units/make-units`); `RelativeTimeRangeOffset`, `ZoomLevel` (`units/types`).
- Produces (this task — pure helpers only; the hook is added in Task 6):
  - `type ResizeEdge = "start" | "end"`
  - `pxToDays(dx: number, zoom: ZoomLevel): number` — pixel delta → snapped whole-day delta
  - `applyMove(range: RelativeTimeRangeOffset, days: number): RelativeTimeRangeOffset`
  - `applyResize(range: RelativeTimeRangeOffset, edge: ResizeEdge, days: number, minDays?: number): RelativeTimeRangeOffset`
  - `rangeToDates(range: RelativeTimeRangeOffset, today: number): { startDate: string; endDate: string }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/components/timeline/use-bar-interaction.test.ts
import { describe, expect, it } from "vitest";
import { startOfUtcDay } from "./units/make-units";
import {
	applyMove,
	applyResize,
	pxToDays,
	rangeToDates,
} from "./use-bar-interaction";

const ONE_DAY = 86_400_000;
const range = { from: 0, to: 3 * ONE_DAY }; // 3-day task starting today

describe("pxToDays", () => {
	it("converts pixels to whole days at the zoom's px/day, rounding", () => {
		// weeks = 32 px/day
		expect(pxToDays(64, "weeks")).toBe(2);
		expect(pxToDays(40, "weeks")).toBe(1); // 1.25 → 1
		expect(pxToDays(-48, "weeks")).toBe(-2); // -1.5 → -2 (round half away)
	});

	it("uses the zoom's scale (months = 8 px/day)", () => {
		expect(pxToDays(24, "months")).toBe(3);
	});
});

describe("applyMove", () => {
	it("shifts both edges by the day delta", () => {
		expect(applyMove(range, 2)).toEqual({ from: 2 * ONE_DAY, to: 5 * ONE_DAY });
		expect(applyMove(range, -1)).toEqual({ from: -ONE_DAY, to: 2 * ONE_DAY });
	});
});

describe("applyResize", () => {
	it("moves the start edge", () => {
		expect(applyResize(range, "start", 1)).toEqual({ from: ONE_DAY, to: 3 * ONE_DAY });
	});

	it("moves the end edge", () => {
		expect(applyResize(range, "end", 2)).toEqual({ from: 0, to: 5 * ONE_DAY });
	});

	it("clamps start so duration stays >= 1 day", () => {
		// pushing start past end-1day is blocked
		expect(applyResize(range, "start", 10)).toEqual({ from: 2 * ONE_DAY, to: 3 * ONE_DAY });
	});

	it("clamps end so duration stays >= 1 day", () => {
		expect(applyResize(range, "end", -10)).toEqual({ from: 0, to: ONE_DAY });
	});
});

describe("rangeToDates", () => {
	it("round-trips a range back to inclusive ISO dates", () => {
		const today = startOfUtcDay(Date.parse("2026-06-01"));
		expect(rangeToDates({ from: 0, to: 3 * ONE_DAY }, today)).toEqual({
			startDate: "2026-06-01",
			endDate: "2026-06-03", // exclusive `to` (+1 day) → inclusive end
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run use-bar-interaction.test.ts`
Expected: FAIL — cannot resolve `./use-bar-interaction`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/components/timeline/use-bar-interaction.ts
import { PX_PER_DAY } from "./controller/geometry";
import { ONE_DAY, toUtcDateString } from "./units/make-units";
import type { RelativeTimeRangeOffset, ZoomLevel } from "./units/types";

export type ResizeEdge = "start" | "end";

/** Pixel delta → whole-day delta at the given zoom (day-snapped). */
export const pxToDays = (dx: number, zoom: ZoomLevel): number =>
	Math.round(dx / PX_PER_DAY[zoom]);

export const applyMove = (
	range: RelativeTimeRangeOffset,
	days: number,
): RelativeTimeRangeOffset => ({
	from: range.from + days * ONE_DAY,
	to: range.to + days * ONE_DAY,
});

export const applyResize = (
	range: RelativeTimeRangeOffset,
	edge: ResizeEdge,
	days: number,
	minDays = 1,
): RelativeTimeRangeOffset => {
	const min = minDays * ONE_DAY;
	if (edge === "start") {
		const from = Math.min(range.from + days * ONE_DAY, range.to - min);
		return { from, to: range.to };
	}
	const to = Math.max(range.to + days * ONE_DAY, range.from + min);
	return { from: range.from, to };
};

/** Inverse of layout's ownRange: exclusive `to` (+1 day) → inclusive end date. */
export const rangeToDates = (
	range: RelativeTimeRangeOffset,
	today: number,
): { startDate: string; endDate: string } => ({
	startDate: toUtcDateString(today + range.from),
	endDate: toUtcDateString(today + range.to - ONE_DAY),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --run use-bar-interaction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
pnpm biome check --write apps/web/src/components/timeline/use-bar-interaction.ts apps/web/src/components/timeline/use-bar-interaction.test.ts
git add apps/web/src/components/timeline/use-bar-interaction.ts apps/web/src/components/timeline/use-bar-interaction.test.ts
git commit -m "feat(timeline): add pure drag/resize math helpers"
```

---

## Task 5: Items state seam (`use-timeline-items.ts`)

**Files:**
- Create: `apps/web/src/components/timeline/use-timeline-items.ts`
- Test: `apps/web/src/components/timeline/use-timeline-items.test.tsx`

**Interfaces:**
- Consumes: `TimelineItem`, `timelineItems` (Task 1).
- Produces:
  - `function useTimelineItems(seed?: TimelineItem[]): { items: TimelineItem[]; updateItem: (id: string, patch: Partial<TimelineItem>) => void; moveDays: (id: string, days: number) => void }`
  - `moveDays`: leaf/milestone → shifts its own dates by `days`; parent → shifts every **descendant leaf/milestone** by `days` (parents recompute via rollup, so they are not stored-shifted).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/timeline/use-timeline-items.test.tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { useTimelineItems } from "./use-timeline-items";

const seed: TimelineItem[] = [
	{ id: "p", kind: "task", name: "Parent", parentId: null, startDate: "2026-06-01", endDate: "2026-06-02", color: "#000" },
	{ id: "c1", kind: "task", name: "C1", parentId: "p", startDate: "2026-06-03", endDate: "2026-06-05", color: "#111" },
	{ id: "c2", kind: "task", name: "C2", parentId: "p", startDate: "2026-06-10", endDate: "2026-06-12", color: "#222" },
];

const find = (items: TimelineItem[], id: string) =>
	items.find((i) => i.id === id);

describe("useTimelineItems", () => {
	it("updateItem patches a single item", () => {
		const { result } = renderHook(() => useTimelineItems(seed));
		act(() => result.current.updateItem("c1", { endDate: "2026-06-07" }));
		expect(find(result.current.items, "c1")?.endDate).toBe("2026-06-07");
	});

	it("moveDays shifts a leaf's own dates", () => {
		const { result } = renderHook(() => useTimelineItems(seed));
		act(() => result.current.moveDays("c1", 2));
		expect(find(result.current.items, "c1")?.startDate).toBe("2026-06-05");
		expect(find(result.current.items, "c1")?.endDate).toBe("2026-06-07");
	});

	it("moveDays on a parent shifts all descendant leaves, not the parent row", () => {
		const { result } = renderHook(() => useTimelineItems(seed));
		act(() => result.current.moveDays("p", 1));
		expect(find(result.current.items, "c1")?.startDate).toBe("2026-06-04");
		expect(find(result.current.items, "c2")?.startDate).toBe("2026-06-11");
		// parent's stored dates are untouched (its span is derived elsewhere)
		expect(find(result.current.items, "p")?.startDate).toBe("2026-06-01");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run use-timeline-items.test.tsx`
Expected: FAIL — cannot resolve `./use-timeline-items`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/components/timeline/use-timeline-items.ts
import { useCallback, useState } from "react";
import { type TimelineItem, timelineItems } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "./units/make-units";

/** Shift an item's own start/end dates by a whole-day delta. */
function shiftDates(item: TimelineItem, days: number): TimelineItem {
	const move = (iso: string) =>
		toUtcDateString(startOfUtcDay(Date.parse(iso)) + days * ONE_DAY);
	return { ...item, startDate: move(item.startDate), endDate: move(item.endDate) };
}

export function useTimelineItems(seed: TimelineItem[] = timelineItems): {
	items: TimelineItem[];
	updateItem: (id: string, patch: Partial<TimelineItem>) => void;
	moveDays: (id: string, days: number) => void;
} {
	const [items, setItems] = useState<TimelineItem[]>(seed);

	const updateItem = useCallback(
		(id: string, patch: Partial<TimelineItem>) => {
			setItems((prev) =>
				prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
			);
		},
		[],
	);

	const moveDays = useCallback((id: string, days: number) => {
		if (days === 0) return;
		setItems((prev) => {
			const hasChildren = prev.some((i) => i.parentId === id);
			if (!hasChildren) {
				return prev.map((i) => (i.id === id ? shiftDates(i, days) : i));
			}
			// Parent: shift all descendants (transitively).
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

	return { items, updateItem, moveDays };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --run use-timeline-items.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
pnpm biome check --write apps/web/src/components/timeline/use-timeline-items.ts apps/web/src/components/timeline/use-timeline-items.test.tsx
git add apps/web/src/components/timeline/use-timeline-items.ts apps/web/src/components/timeline/use-timeline-items.test.tsx
git commit -m "feat(timeline): add useTimelineItems state seam"
```

---

## Task 6: Render layer + drag/resize, wire in, remove task-bars

This task delivers the visible feature: `items-layer.tsx` renders containers, task bars (with resize handles + progress), milestones, and off-screen fly-outs, plus the `useBarInteraction` gesture hook that produces a live draft and commits day-snapped edits. It then replaces `<TaskBars />` and deletes the superseded files.

**Files:**
- Modify: `apps/web/src/components/timeline/use-bar-interaction.ts` (add the `useBarInteraction` hook)
- Create: `apps/web/src/components/timeline/items-layer.tsx`
- Create: `apps/web/src/components/timeline/items-layer.test.tsx`
- Modify: `apps/web/src/components/timeline/container/index.tsx`
- Delete: `apps/web/src/components/timeline/task-bars.tsx`, `apps/web/src/components/timeline/task-bars.test.tsx`, `apps/web/src/data/tasks.ts`

**Interfaces:**
- Consumes: `layoutItems`, `RenderRow`, `ContainerRect` (Task 3); `pxToDays`, `applyMove`, `applyResize`, `rangeToDates`, `ResizeEdge` (Task 4); `useTimelineItems` (Task 5); `useTimelineController`, `useHorizontalPercentageOffset`, `rangeVisibility`, `type Geometry` (existing).
- Produces:
  - In `use-bar-interaction.ts`: `type GestureRole = "move" | "resize-start" | "resize-end"`; `type GestureTarget = { role: GestureRole; id: string; range: RelativeTimeRangeOffset; descendantIds: string[] }`; `useBarInteraction(opts: { onCommitMove: (id: string, days: number) => void; onCommitResize: (id: string, range: RelativeTimeRangeOffset) => void }): { draft: Record<string, RelativeTimeRangeOffset>; beginGesture: (e: ReactPointerEvent, target: GestureTarget) => void }`
  - `export default function ItemsLayer()`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/timeline/items-layer.test.tsx
import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import ItemsLayer from "./items-layer";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderLayer(width = 100000) {
	// huge width so the whole seed span is on-screen (no fly-outs)
	return render(
		<TimelineProvider initialZoom="weeks">
			<SizeViewport width={width} />
			<ItemsLayer />
		</TimelineProvider>,
	);
}

describe("ItemsLayer", () => {
	it("renders parent containers, task bars, and milestone markers", () => {
		const { container } = renderLayer();
		expect(
			container.querySelectorAll("[data-testid='timeline-container-rect']").length,
		).toBeGreaterThan(0);
		expect(
			container.querySelectorAll("[data-testid='timeline-task-bar']").length,
		).toBeGreaterThan(0);
		expect(
			container.querySelectorAll("[data-testid='timeline-milestone']").length,
		).toBeGreaterThan(0);
	});

	it("shows a fly-out for off-screen items in a narrow viewport", () => {
		const { container } = renderLayer(320);
		expect(
			container.querySelectorAll("[data-testid^='timeline-item-flyout-']").length,
		).toBeGreaterThan(0);
	});

	it("moves a task bar's position after a drag gesture", () => {
		const { container } = renderLayer();
		const bar = container.querySelector(
			"[data-testid='timeline-task-bar']",
		) as HTMLElement;
		const before = bar.style.left;
		fireEvent.pointerDown(bar, { clientX: 0, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 320, pointerId: 1 }); // 10 days @ weeks
		fireEvent.pointerUp(window, { clientX: 320, pointerId: 1 });
		const after = (
			container.querySelector("[data-testid='timeline-task-bar']") as HTMLElement
		).style.left;
		expect(after).not.toBe(before);
	});

	it("resizes the end edge via its handle", () => {
		const { container } = renderLayer();
		const handle = container.querySelector(
			"[data-testid='timeline-resize-end']",
		) as HTMLElement;
		const bar = handle.closest(
			"[data-testid='timeline-task-bar']",
		) as HTMLElement;
		const widthBefore = bar.style.width;
		fireEvent.pointerDown(handle, { clientX: 0, pointerId: 2 });
		fireEvent.pointerMove(window, { clientX: 160, pointerId: 2 }); // +5 days
		fireEvent.pointerUp(window, { clientX: 160, pointerId: 2 });
		const widthAfter = (
			container.querySelector("[data-testid='timeline-task-bar']") as HTMLElement
		).style.width;
		expect(widthAfter).not.toBe(widthBefore);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run items-layer.test.tsx`
Expected: FAIL — cannot resolve `./items-layer`.

- [ ] **Step 3a: Add the gesture hook** (append to `use-bar-interaction.ts`)

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { useTimelineController } from "./controller/context";

export type GestureRole = "move" | "resize-start" | "resize-end";

export type GestureTarget = {
	role: GestureRole;
	id: string;
	range: RelativeTimeRangeOffset;
	/** leaf/milestone ids shifted alongside a parent move; empty otherwise. */
	descendantIds: string[];
};

/**
 * Pointer-driven move/resize. Produces a live `draft` (id → range) during the
 * gesture and commits a day-snapped edit on release.
 */
export function useBarInteraction(opts: {
	onCommitMove: (id: string, days: number) => void;
	onCommitResize: (id: string, range: RelativeTimeRangeOffset) => void;
}): {
	draft: Record<string, RelativeTimeRangeOffset>;
	beginGesture: (e: ReactPointerEvent, target: GestureTarget) => void;
} {
	const { zoomLevel } = useTimelineController();
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;
	const [draft, setDraft] = useState<Record<string, RelativeTimeRangeOffset>>({});

	const beginGesture = useCallback(
		(e: ReactPointerEvent, target: GestureTarget) => {
			e.stopPropagation();
			e.preventDefault();
			const startX = e.clientX;
			const target0 = e.currentTarget;
			target0.setPointerCapture(e.pointerId);

			const compute = (dx: number): Record<string, RelativeTimeRangeOffset> => {
				const days = pxToDays(dx, zoomRef.current);
				if (target.role === "move") {
					// Live-preview the targeted bar only; for a parent move, descendants
					// snap into place on release via moveDays (v1 simplification).
					return { [target.id]: applyMove(target.range, days) };
				}
				const edge = target.role === "resize-start" ? "start" : "end";
				return { [target.id]: applyResize(target.range, edge, days) };
			};

			const onMove = (ev: PointerEvent) => {
				setDraft(compute(ev.clientX - startX));
			};
			const onUp = (ev: PointerEvent) => {
				const days = pxToDays(ev.clientX - startX, zoomRef.current);
				if (target.role === "move") opts.onCommitMove(target.id, days);
				else
					opts.onCommitResize(
						target.id,
						applyResize(
							target.range,
							target.role === "resize-start" ? "start" : "end",
							days,
						),
					);
				setDraft({});
				try {
					target0.releasePointerCapture(ev.pointerId);
				} catch {}
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		},
		[opts],
	);

	return { draft, beginGesture };
}
```

Note: descendant live-preview during a parent move is handled in the layer by also
drafting each descendant from the same day delta (the layer owns descendant ranges).
The hook commits the parent move via `onCommitMove`, and `useTimelineItems.moveDays`
shifts the descendants in state; the rollup recomputes the parent. Keep the hook's
`draft` keyed only by the directly-targeted id; the layer overlays descendant drafts
(Step 3b).

- [ ] **Step 3b: Create the render layer**

```tsx
// apps/web/src/components/timeline/items-layer.tsx
import { cn } from "@orbit/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useTimelineController } from "./controller/context";
import { type Geometry, rangeVisibility } from "./controller/geometry";
import { useHorizontalPercentageOffset } from "./controller/hooks";
import { type ContainerRect, layoutItems, type RenderRow } from "./controller/layout";
import {
	type GestureTarget,
	useBarInteraction,
} from "./use-bar-interaction";
import { useTimelineItems } from "./use-timeline-items";
import type { RelativeTimeRangeOffset } from "./units/types";

const ROW_HEIGHT = 40;
const ROW_PADDING = 7;

export default function ItemsLayer() {
	const { today, offsetMs, zoomLevel, viewportWidth, scrollToMs } =
		useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { items, updateItem, moveDays } = useTimelineItems();

	const { rows, containers } = useMemo(
		() => layoutItems(items, today),
		[items, today],
	);

	const { draft, beginGesture } = useBarInteraction({
		onCommitMove: (id, days) => moveDays(id, days),
		onCommitResize: (id, range) =>
			updateItem(id, rangeToDatesPatch(range, today)),
	});

	if (viewportWidth <= 0) return null;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };

	// effective range = draft override (live drag) else laid-out range
	const rangeOf = (row: RenderRow): RelativeTimeRangeOffset =>
		draft[row.item.id] ?? row.range;

	const descendantsOf = (parentId: string): string[] =>
		rows
			.filter((r) => r.item.parentId === parentId && !r.isParent)
			.map((r) => r.item.id);

	return (
		<div className="pointer-events-none absolute inset-0">
			{/* parent container rects (behind bars) */}
			{containers.map((c: ContainerRect) => {
				const left = getPercentageOffset(c.range.from);
				const right = getPercentageOffset(c.range.to);
				if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
				return (
					<div
						key={`container-${c.parentId}`}
						data-testid="timeline-container-rect"
						className="absolute rounded-lg border border-border/60 bg-muted/20"
						style={{
							left: `${left}%`,
							width: `${Math.max(right - left, 0)}%`,
							top: c.rowStart * ROW_HEIGHT + 2,
							height: (c.rowEnd - c.rowStart + 1) * ROW_HEIGHT - 4,
						}}
					/>
				);
			})}

			{/* rows */}
			{rows.map((row) => {
				const range = rangeOf(row);
				const top = row.rowIndex * ROW_HEIGHT + ROW_PADDING;
				const barHeight = ROW_HEIGHT - ROW_PADDING * 2;
				const centerMs = (range.from + range.to) / 2;
				const visibility = rangeVisibility(range.from, range.to, geom);
				const { item } = row;

				if (visibility !== "visible") {
					const side = visibility;
					return (
						<button
							key={item.id}
							type="button"
							data-testid={`timeline-item-flyout-${side}`}
							onClick={() => scrollToMs(centerMs)}
							title={`Jump to “${item.name}”`}
							style={{ top, height: barHeight }}
							className={cn(
								"pointer-events-auto absolute z-20 flex items-center gap-1 rounded-md border border-border bg-popover px-1.5 text-xs font-medium text-foreground shadow-md hover:bg-accent",
								side === "left" ? "left-1" : "right-1",
							)}
						>
							{side === "left" && <ChevronLeft className="size-3.5 shrink-0" />}
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span className="max-w-28 truncate">{item.name}</span>
							{side === "right" && <ChevronRight className="size-3.5 shrink-0" />}
						</button>
					);
				}

				const left = getPercentageOffset(range.from);

				// Milestone: a diamond point marker at range.from.
				if (item.kind === "milestone") {
					if (!Number.isFinite(left)) return null;
					const moveTarget: GestureTarget = {
						role: "move",
						id: item.id,
						range,
						descendantIds: [],
					};
					return (
						<div
							key={item.id}
							data-testid="timeline-milestone"
							title={item.name}
							onPointerDown={(e) => beginGesture(e, moveTarget)}
							style={{ left: `${left}%`, top: top + barHeight / 2 }}
							className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 size-3 rotate-45 cursor-grab rounded-[2px] active:cursor-grabbing"
						>
							<span
								className="block size-full rotate-45"
								style={{ backgroundColor: item.color }}
							/>
						</div>
					);
				}

				const right = getPercentageOffset(range.to);
				if (!Number.isFinite(left) || !Number.isFinite(right)) return null;

				const moveTarget: GestureTarget = {
					role: "move",
					id: item.id,
					range,
					descendantIds: row.isParent ? descendantsOf(item.id) : [],
				};

				return (
					<div
						key={item.id}
						data-testid="timeline-task-bar"
						title={item.name}
						onPointerDown={(e) => beginGesture(e, moveTarget)}
						style={{
							left: `${left}%`,
							width: `${Math.max(right - left, 0)}%`,
							top,
							height: barHeight,
							backgroundColor: row.isParent ? "transparent" : item.color,
							borderColor: item.color,
						}}
						className={cn(
							"pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 text-xs font-medium shadow-sm",
							row.isParent
								? "cursor-grab border-2 active:cursor-grabbing"
								: "cursor-grab text-white active:cursor-grabbing",
						)}
					>
						{!row.isParent && item.progress !== undefined && (
							<span
								className="absolute inset-y-0 left-0 bg-black/20"
								style={{ width: `${item.progress}%` }}
							/>
						)}
						<span
							className={cn(
								"relative truncate",
								row.isParent && "text-foreground",
							)}
						>
							{item.name}
						</span>

						{/* resize handles (leaf tasks only) */}
						{!row.isParent && (
							<>
								<span
									data-testid="timeline-resize-start"
									onPointerDown={(e) =>
										beginGesture(e, {
											role: "resize-start",
											id: item.id,
											range,
											descendantIds: [],
										})
									}
									className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
								/>
								<span
									data-testid="timeline-resize-end"
									onPointerDown={(e) =>
										beginGesture(e, {
											role: "resize-end",
											id: item.id,
											range,
											descendantIds: [],
										})
									}
									className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
								/>
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}

/** Adapt rangeToDates into an updateItem patch. */
function rangeToDatesPatch(range: RelativeTimeRangeOffset, today: number) {
	const { startDate, endDate } = rangeToDates(range, today);
	return { startDate, endDate };
}
```

Add the missing import at the top of `items-layer.tsx`:

```ts
import { rangeToDates } from "./use-bar-interaction";
```

- [ ] **Step 3c: Wire into the container** (`container/index.tsx`)

Replace the `TaskBars` import and usage:

```tsx
// import line: replace `import TaskBars from "../task-bars";`
import ItemsLayer from "../items-layer";
```

```tsx
// in the grid layer, replace `<TaskBars />` with:
<ItemsLayer />
```

- [ ] **Step 3d: Delete superseded files**

```bash
cd /Users/thinhle/Documents/Development/orbit
git rm apps/web/src/components/timeline/task-bars.tsx \
       apps/web/src/components/timeline/task-bars.test.tsx \
       apps/web/src/data/tasks.ts
# verify nothing else imports the removed modules:
grep -rn "task-bars\|data/tasks\"" apps/web/src && echo "FOUND REFERENCES — fix before continuing" || echo "clean"
```

Expected: `clean` (no remaining references).

- [ ] **Step 4: Run tests + typecheck**

Run: `cd apps/web && pnpm test -- --run`
Expected: PASS — all suites, including `items-layer.test.tsx` (4 tests). No `task-bars` suite.

Run: `cd /Users/thinhle/Documents/Development/orbit && pnpm typecheck`
Expected: clean (no errors).

If `useBarInteraction`'s `compute` for `move` leaves an empty descendant loop body that
trips lint, delete the dead loop — descendant live-preview is overlaid by the layer in a
follow-up; the committed move already shifts descendants via `moveDays`. (Keep the parent's
own draft so the parent bar tracks the cursor live.)

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
pnpm biome check --write apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/items-layer.test.tsx apps/web/src/components/timeline/use-bar-interaction.ts apps/web/src/components/timeline/container/index.tsx
git add apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/items-layer.test.tsx apps/web/src/components/timeline/use-bar-interaction.ts apps/web/src/components/timeline/container/index.tsx
git commit -m "feat(timeline): render item hierarchy with drag/resize, replace task-bars"
```

---

## Manual verification (after Task 6)

Run the app (`pnpm dev`), open the timeline route, and confirm:
- Parent tasks show a container box wrapping their subtasks; the parent summary bar spans min→max of children.
- Milestones render as diamonds at their date.
- Dragging a leaf bar moves it in whole-day steps; releasing keeps the new dates.
- Dragging a leaf's left/right edge resizes it, never below one day.
- Dragging a parent bar shifts all its subtasks together; the container re-fits on release.
- Scrolling a bar off-screen shows a fly-out chip; clicking it re-centers that item.
- Wheel and the synthetic scrollbar still pan; dragging empty background does not pan.

---

## Self-Review

**Spec coverage:**
- Unified model (task/milestone, parentId) → Task 1. ✓
- Derived parent rollup + container wrap → Task 3 (`layoutItems`), Task 6 (container rects render). ✓
- Drag move / edge resize / milestone move, snap to day → Task 4 (math) + Task 6 (hook + handles). ✓
- Parent move shifts descendants → Task 5 (`moveDays`) + Task 6 (commit). ✓
- Persistence seam → Task 5 (`useTimelineItems`). ✓
- Off-screen fly-out preserved → Task 6 (carried into `ItemsLayer`). ✓
- Remove `task-bars.tsx` → Task 6 Step 3d. ✓
- Deferred (collapse/expand, dependency editing, multi-select, backend) → not planned, per spec non-goals. ✓

**Type consistency:** `RelativeTimeRangeOffset` used uniformly for ranges; `RenderRow`/`ContainerRect` defined in Task 3 and consumed unchanged in Task 6; `GestureTarget`/`useBarInteraction` defined in Task 6 Step 3a and used in 3b; `rangeToDates`/`applyResize`/`applyMove`/`pxToDays` signatures match between Task 4 and Task 6.

**Known simplification carried by the plan:** during a *parent* drag, only the parent bar previews live (descendants snap on release via `moveDays`); during a *leaf* drag the bar previews live. This is intentional for v1 and called out in Task 6 Step 3a/Step 4 notes.
