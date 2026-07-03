# Scheduler Variable Bar Heights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each scheduler task bar at a height proportional to its `estimatedTime` (minutes), clamped to a min/max, with lanes sized to their tallest bar.

**Architecture:** `packLanes` (time-axis interval packing) is untouched. A pure `barHeight(item)` maps minutes→pixels. A new `stackLanes` helper turns packed lanes into vertically-positioned lanes (prefix-sum tops, lane height = tallest bar). The renderer positions each bar top-aligned within its lane.

**Tech Stack:** React 19, TypeScript, Vitest. All web tests run from `apps/web`.

## Global Constraints

- `estimatedTime` unit is **minutes**; leaf tasks only; optional.
- Items without `estimatedTime` (milestones, parent tasks) fall back to `MIN_BAR_HEIGHT`.
- Height mapping is clamped-linear: `clamp(estimatedTime * PX_PER_MINUTE, MIN_BAR_HEIGHT, MAX_BAR_HEIGHT)`.
- Shorter bars are **top-aligned** within their lane.
- `pack-lanes.ts` must NOT be modified.
- TypeScript: `camelCase` values, `PascalCase` types; avoid `any`.
- Run web tests from `apps/web` with `pnpm test <pattern>` (Vitest).

---

### Task 1: Height mapping — `estimatedTime` field + `barHeight`

**Files:**
- Modify: `apps/web/src/data/timeline-items.ts` (add field to `TimelineItem`)
- Modify: `apps/web/src/components/timeline/scheduler/lane-metrics.ts`
- Test: `apps/web/src/components/timeline/scheduler/lane-metrics.test.ts` (create)

**Interfaces:**
- Produces: `MIN_BAR_HEIGHT = 24`, `MAX_BAR_HEIGHT = 96`, `PX_PER_MINUTE = 0.2`, `LANE_GAP = 8`, `GROUP_PADDING = 8` (all `number`); `barHeight(item: TimelineItem): number`.
- Removes: `LANE_HEIGHT`, `LANE_PADDING`, `groupHeight`.

- [ ] **Step 1: Add the `estimatedTime` field to `TimelineItem`**

In `apps/web/src/data/timeline-items.ts`, inside the `TimelineItem` type, add after the `progress?` line:

```ts
	/** Estimated effort in minutes, leaf tasks only. Drives bar height in scheduler. */
	estimatedTime?: number;
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/components/timeline/scheduler/lane-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { barHeight, MAX_BAR_HEIGHT, MIN_BAR_HEIGHT } from "./lane-metrics";

function item(estimatedTime?: number): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
		estimatedTime,
	};
}

describe("barHeight", () => {
	it("falls back to MIN_BAR_HEIGHT when estimatedTime is absent", () => {
		expect(barHeight(item(undefined))).toBe(MIN_BAR_HEIGHT);
	});

	it("clamps small estimates to the floor", () => {
		// 60min * 0.2 = 12 → clamped up to 24
		expect(barHeight(item(60))).toBe(MIN_BAR_HEIGHT);
	});

	it("clamps large estimates to the ceiling", () => {
		// 1000min * 0.2 = 200 → clamped down to 96
		expect(barHeight(item(1000))).toBe(MAX_BAR_HEIGHT);
	});

	it("scales linearly in the middle band", () => {
		// 300min * 0.2 = 60
		expect(barHeight(item(300))).toBe(60);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm test lane-metrics`
Expected: FAIL — `barHeight`/`MAX_BAR_HEIGHT`/`MIN_BAR_HEIGHT` not exported.

- [ ] **Step 4: Rewrite `lane-metrics.ts`**

Replace the entire contents of `apps/web/src/components/timeline/scheduler/lane-metrics.ts` with:

```ts
import type { TimelineItem } from "@/data/timeline-items";

/** Bar height for a task with no estimate (milestones, parents). Tunable. */
export const MIN_BAR_HEIGHT = 24;
/** Ceiling so one large estimate can't dominate a row. Tunable. */
export const MAX_BAR_HEIGHT = 96;
/** 0.2 → 480min (8h) reaches MAX; ≤120min sits at MIN. Tunable. */
export const PX_PER_MINUTE = 0.2;
/** Vertical gap between stacked lanes within a group. */
export const LANE_GAP = 8;
/** Padding above/below the stack of lanes inside a group row. */
export const GROUP_PADDING = 8;

/** Pixel height of a bar, from its estimatedTime (minutes), clamped-linear. */
export function barHeight(item: TimelineItem): number {
	if (item.estimatedTime == null) return MIN_BAR_HEIGHT;
	const raw = item.estimatedTime * PX_PER_MINUTE;
	return Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, raw));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test lane-metrics`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/data/timeline-items.ts apps/web/src/components/timeline/scheduler/lane-metrics.ts apps/web/src/components/timeline/scheduler/lane-metrics.test.ts
git commit -m "feat(web): add estimatedTime field and barHeight mapping"
```

---

### Task 2: Vertical stacking — `stackLanes` + positioned rows

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/layout.ts`
- Test: `apps/web/src/components/timeline/scheduler/layout.test.ts`

**Interfaces:**
- Consumes: `barHeight`, `LANE_GAP`, `GROUP_PADDING`, `MIN_BAR_HEIGHT` from `./lane-metrics`; `packLanes`, `PackedBar` from `./pack-lanes`.
- Produces:
  - `PositionedLane = { bars: PackedBar[]; top: number; height: number }`
  - `stackLanes(lanes: PackedBar[][]): { lanes: PositionedLane[]; height: number }`
  - `SchedulerRow.lanes` is now `PositionedLane[]` (was `PackedBar[][]`).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/components/timeline/scheduler/layout.test.ts` a new import line and a `stackLanes` describe block. First replace the existing import of lane-metrics:

```ts
import { GROUP_PADDING, LANE_GAP, MIN_BAR_HEIGHT } from "./lane-metrics";
import { layoutScheduler, stackLanes } from "./layout";
import type { PackedBar } from "./pack-lanes";
```

Then update the existing `layoutScheduler` height assertion (two no-estimate tasks → two 24px lanes):

```ts
		const expectedHeight = 2 * MIN_BAR_HEIGHT + LANE_GAP + GROUP_PADDING * 2;
		expect(rows[0].height).toBe(expectedHeight);
		expect(totalHeight).toBe(expectedHeight);
```

Add a new describe block:

```ts
describe("stackLanes", () => {
	const bar = (estimatedTime?: number): PackedBar => ({
		item: {
			id: "t",
			kind: "task",
			name: "T",
			parentId: null,
			startDate: "2026-06-01",
			endDate: "2026-06-02",
			color: "#000",
			estimatedTime,
		},
		range: { from: 0, to: 1 },
	});

	it("sizes each lane to its tallest bar and stacks tops with a gap", () => {
		// lane 0: max(300→60, 60→24) = 60; lane 1: 1000→clamped 96
		const { lanes, height } = stackLanes([[bar(300), bar(60)], [bar(1000)]]);

		expect(lanes[0].top).toBe(0);
		expect(lanes[0].height).toBe(60);
		expect(lanes[1].top).toBe(60 + LANE_GAP);
		expect(lanes[1].height).toBe(96);
		expect(height).toBe(60 + 96 + LANE_GAP + GROUP_PADDING * 2);
	});

	it("falls back to MIN_BAR_HEIGHT for an empty lane list", () => {
		const { lanes, height } = stackLanes([]);
		expect(lanes).toHaveLength(0);
		expect(height).toBe(MIN_BAR_HEIGHT + GROUP_PADDING * 2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test scheduler/layout`
Expected: FAIL — `stackLanes` not exported.

- [ ] **Step 3: Rewrite `layout.ts`**

Replace the entire contents of `apps/web/src/components/timeline/scheduler/layout.ts` with:

```ts
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows, type GroupingMode } from "./group-rows";
import { barHeight, GROUP_PADDING, LANE_GAP, MIN_BAR_HEIGHT } from "./lane-metrics";
import { type PackedBar, packLanes } from "./pack-lanes";

export type PositionedLane = {
	bars: PackedBar[];
	/** Cumulative pixel offset from the start of the lane stack (after GROUP_PADDING). */
	top: number;
	/** Lane height = tallest bar in the lane. */
	height: number;
};

export type SchedulerRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	top: number;
	height: number;
	lanes: PositionedLane[];
};

/**
 * Stack packed lanes vertically. Each lane is sized to its tallest bar; lanes
 * are separated by LANE_GAP. Returns positioned lanes plus the group's total
 * pixel height (including GROUP_PADDING top and bottom).
 */
export function stackLanes(lanes: PackedBar[][]): {
	lanes: PositionedLane[];
	height: number;
} {
	let top = 0;
	const positioned: PositionedLane[] = lanes.map((bars, i) => {
		const laneHeight = Math.max(...bars.map((b) => barHeight(b.item)));
		const lane: PositionedLane = { bars, top, height: laneHeight };
		top += laneHeight;
		if (i < lanes.length - 1) top += LANE_GAP;
		return lane;
	});
	const stackHeight = positioned.length === 0 ? MIN_BAR_HEIGHT : top;
	return { lanes: positioned, height: stackHeight + GROUP_PADDING * 2 };
}

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
		const packed = packLanes(g.tasks, today);
		const { lanes, height } = stackLanes(packed);
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test scheduler/layout`
Expected: PASS (existing `layoutScheduler` test + 2 new `stackLanes` tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/layout.ts apps/web/src/components/timeline/scheduler/layout.test.ts
git commit -m "feat(web): stack scheduler lanes by variable bar height"
```

---

### Task 3: Render bars at per-bar height

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx:59`
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (existing, run only)

**Interfaces:**
- Consumes: `barHeight`, `GROUP_PADDING` from `./lane-metrics`; `PositionedLane`/`SchedulerRow` from `./layout`.

- [ ] **Step 1: Update the lane-metrics import in `scheduler-lanes.tsx`**

In `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`, replace:

```ts
import { GROUP_PADDING, LANE_HEIGHT, LANE_PADDING } from "./lane-metrics";
```

with:

```ts
import { barHeight, GROUP_PADDING } from "./lane-metrics";
```

- [ ] **Step 2: Remove the fixed bar-height constant**

In the same file, delete this line (currently inside the component body, ~line 25):

```ts
	const barHeight = LANE_HEIGHT - LANE_PADDING * 2;
```

- [ ] **Step 3: Rewrite the lane/bar mapping to use positioned lanes**

Replace the `row.lanes.map(...)` block (the `row.lanes.map((lane, laneIndex) => lane.map(({ item, range }) => {` structure) so it iterates `lane.bars` and computes per-bar top/height. The new mapping:

```tsx
				{rows.map((row) =>
					row.lanes.map((lane) =>
						lane.bars.map(({ item, range }) => {
							if (rangeVisibility(range.from, range.to, geom) !== "visible") {
								return null;
							}
							const left = getPercentageOffset(range.from);
							const right = getPercentageOffset(range.to);
							if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
							const width = Math.max(right - left, minWidthPercent);
							const top = row.top + GROUP_PADDING + lane.top;
							const height = barHeight(item);
							const selected = isSelected(item.id);
							const hovered = hoveredId === item.id;
							return (
```

Leave the returned `<button>` JSX unchanged — it already reads `top` and `height` from these locals.

- [ ] **Step 4: Fix the task-count reducer in `scheduler-layout.tsx`**

In `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx` line 59, replace:

```tsx
				{row.lanes.reduce((n, lane) => n + lane.length, 0)}
```

with:

```tsx
				{row.lanes.reduce((n, lane) => n + lane.bars.length, 0)}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && pnpm typecheck` (or `pnpm --filter web typecheck` from root)
Expected: no errors. Confirms no remaining references to `LANE_HEIGHT`/`LANE_PADDING` or the old `PackedBar[][]` shape.

- [ ] **Step 6: Run the scheduler integration test**

Run: `cd apps/web && pnpm test scheduler`
Expected: PASS — `scheduler-view.test.tsx` and `layout.test.ts` and `lane-metrics.test.ts` all green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-layout.tsx
git commit -m "feat(web): render scheduler bars at estimatedTime height"
```

---

### Task 4: Populate demo estimates and verify end-to-end

**Files:**
- Modify: `apps/web/src/data/timeline-items.ts`

**Interfaces:**
- Consumes: the `estimatedTime?: number` field added in Task 1.

- [ ] **Step 1: Add `estimatedTime` to several leaf tasks**

In `apps/web/src/data/timeline-items.ts`, add `estimatedTime` (minutes) to a spread of **leaf** `kind: "task"` items (not milestones, not parent tasks that carry placeholder dates) so heights visibly vary. Choose values spanning the range — e.g. a short task `estimatedTime: 90`, a medium `estimatedTime: 300`, a large `estimatedTime: 900`. Add the field to at least 5–6 leaf tasks across different assignees. Example edit for one item:

```ts
	{
		id: "t-...",           // an existing leaf task id
		kind: "task",
		name: "...",
		parentId: "...",
		startDate: "...",
		endDate: "...",
		progress: ...,
		color: "...",
		assignee: assignees...,
		estimatedTime: 300,
	},
```

- [ ] **Step 2: Run the full web test suite**

Run: `cd apps/web && pnpm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Verify visually**

Start the app (`pnpm dev` from repo root), open the scheduler view, and confirm bars render at differing heights, lanes size to the tallest bar, and shorter bars sit at the lane top. Tasks without `estimatedTime` render at the minimum height.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/timeline-items.ts
git commit -m "chore(web): seed estimatedTime on demo scheduler tasks"
```

---

## Self-Review

- **Spec coverage:** data model → Task 1; height mapping → Task 1; fallback → Task 1 (test) + Task 4 (data); lane sizing/top-align → Task 2 + Task 3; packLanes untouched → honored (not in any Files list); tests → Tasks 1–3; demo data → Task 4. All covered.
- **Type consistency:** `barHeight(item)`, `PositionedLane { bars, top, height }`, `stackLanes(lanes): { lanes, height }`, `SchedulerRow.lanes: PositionedLane[]` used identically across tasks. Renderer and `scheduler-layout.tsx` both updated to `lane.bars`.
- **Placeholder scan:** none — every code step shows full code; Task 4 values are illustrative but concrete.
