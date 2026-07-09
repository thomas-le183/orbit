# Scheduler Row Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render only the scheduler rows near the viewport, so scroll cost scales with the viewport instead of the project.

**Architecture:** `layoutScheduler` already returns exact `top`/`height` per row, so this is a *known-size* variable-height virtualizer — no DOM measurement, no `measureElement`. A scheduler-local hook wraps `useVirtualizer`, converts its output to a `{ first, last }` row window, and slices `rows` down to `visibleRows` through a pure function. `SchedulerLayoutInner` owns the hook and passes `visibleRows` to both consumers (the group column and `SchedulerLanes`), so neither consumer learns anything about virtualization.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-virtual` ^3.14.3 (already a dependency of `apps/web`), Vitest + `@testing-library/react`, Biome.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-09-scheduler-row-virtualization-design.md`.
- **Do not modify** `layout.ts`, `pack-lanes.ts`, `group-rows.ts`, `lane-metrics.ts`, or `layout/virtual-rows.tsx` (the Gantt's provider). No attempt to generalize the Gantt provider.
- **Do not modify** the bar JSX, the rename `<input>` and its `renameCommittedRef`, the create surface, or the drop target in `scheduler-lanes.tsx`. Recent commits landed drag-to-create and inline-rename there; this change must not collide with them. The only edit to that file is a prop rename.
- **`resolveLaneAt` must keep closing over the full `rows` array**, never `visibleRows`. It hit-tests by coordinate math, so drags over culled rows must still resolve a lane. Switching it is a correctness bug.
- The eight existing tests in `scheduler-view.test.tsx` must pass **unmodified**.
- Overscan constant: `2`.
- Run Vitest scoped to single files. The full suite exhausts memory on this machine (`cd apps/web && pnpm test -- <file>`).
- Formatting: `pnpm check` from the repo root (Biome). Tabs, not spaces — match surrounding files.
- Commit after each task.

---

### Task 1: Pure slice core

The virtualizer is impure and awkward under jsdom, so all correctness lives in two pure functions that the hook merely feeds. This is what the unit tests target.

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/use-scheduler-rows.ts`
- Test: `apps/web/src/components/timeline/scheduler/use-scheduler-rows.test.ts`

**Interfaces:**
- Consumes: `SchedulerRow` from `./layout` (fields used: `key`, `top`, `height`, `lanes[].bars[].item.id`).
- Produces:
  - `type RowWindow = { first: number; last: number } | null`
  - `sliceVisibleRows(rows: SchedulerRow[], window: RowWindow, pinnedKeys: ReadonlySet<string>): SchedulerRow[]`
  - `buildItemRowIndex(rows: SchedulerRow[]): Map<string, string>` — maps item id → owning `row.key`
  - `SCHEDULER_OVERSCAN: number`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/scheduler/use-scheduler-rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import type { SchedulerRow } from "./layout";
import { buildItemRowIndex, sliceVisibleRows } from "./use-scheduler-rows";

const EMPTY: ReadonlySet<string> = new Set();

function bar(id: string) {
	return {
		item: { id, kind: "task", name: id } as unknown as TimelineItem,
		range: { from: 0, to: 0 },
	};
}

/** Row `k` at index `i`, 100px tall, owning the given item ids. */
function row(k: string, i: number, itemIds: string[] = []): SchedulerRow {
	return {
		key: k,
		label: k,
		top: i * 100,
		height: 100,
		lanes: [{ bars: itemIds.map(bar), top: 0, height: 24 }],
	} as SchedulerRow;
}

const rows = [
	row("a", 0, ["t1"]),
	row("b", 1, ["t2", "t3"]),
	row("c", 2),
	row("d", 3, ["t4"]),
	row("e", 4),
];

const keys = (rs: SchedulerRow[]) => rs.map((r) => r.key);

describe("sliceVisibleRows", () => {
	it("returns every row when the window is null (unmeasured viewport)", () => {
		expect(sliceVisibleRows(rows, null, EMPTY)).toBe(rows);
	});

	it("returns only rows inside the inclusive window", () => {
		expect(keys(sliceVisibleRows(rows, { first: 1, last: 3 }, EMPTY))).toEqual([
			"b",
			"c",
			"d",
		]);
	});

	it("handles an empty row list", () => {
		expect(sliceVisibleRows([], { first: 0, last: 0 }, EMPTY)).toEqual([]);
	});

	it("includes pinned rows that fall outside the window", () => {
		const pinned = new Set(["e"]);
		expect(keys(sliceVisibleRows(rows, { first: 0, last: 1 }, pinned))).toEqual([
			"a",
			"b",
			"e",
		]);
	});

	it("keeps pinned rows in row order, not pin order", () => {
		const pinned = new Set(["e", "a"]);
		expect(keys(sliceVisibleRows(rows, { first: 2, last: 2 }, pinned))).toEqual([
			"a",
			"c",
			"e",
		]);
	});

	it("does not duplicate a pinned row already inside the window", () => {
		const pinned = new Set(["b"]);
		expect(keys(sliceVisibleRows(rows, { first: 1, last: 2 }, pinned))).toEqual([
			"b",
			"c",
		]);
	});
});

describe("buildItemRowIndex", () => {
	it("maps every bar's item id to its owning row key", () => {
		const index = buildItemRowIndex(rows);
		expect(index.get("t1")).toBe("a");
		expect(index.get("t2")).toBe("b");
		expect(index.get("t3")).toBe("b");
		expect(index.get("t4")).toBe("d");
	});

	it("omits ids that belong to no row", () => {
		expect(buildItemRowIndex(rows).get("nope")).toBeUndefined();
	});

	it("returns an empty map for no rows", () => {
		expect(buildItemRowIndex([]).size).toBe(0);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && pnpm test -- use-scheduler-rows
```

Expected: FAIL — `Failed to resolve import "./use-scheduler-rows"`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/src/components/timeline/scheduler/use-scheduler-rows.ts`:

```ts
import type { SchedulerRow } from "./layout";

/**
 * Rows near the viewport, in row indices. `null` means "not measured yet" —
 * render everything rather than flash an empty pane.
 */
export type RowWindow = { first: number; last: number } | null;

/**
 * Rows rendered above and below the window. Deliberately lower than the Gantt's
 * 8: scheduler rows are variable-height and a row with many lanes can exceed
 * the viewport, so each overscanned row costs far more DOM.
 */
export const SCHEDULER_OVERSCAN = 2;

/**
 * Narrow `rows` to those inside `window`, plus any row whose key is pinned.
 * Filtering (rather than concatenating) keeps the result in row order and makes
 * a pinned row already inside the window a no-op.
 */
export function sliceVisibleRows(
	rows: SchedulerRow[],
	window: RowWindow,
	pinnedKeys: ReadonlySet<string>,
): SchedulerRow[] {
	if (!window) return rows;
	const { first, last } = window;
	return rows.filter(
		(row, i) => (i >= first && i <= last) || pinnedKeys.has(row.key),
	);
}

/** item id → key of the row whose lanes contain that item's bar. */
export function buildItemRowIndex(rows: SchedulerRow[]): Map<string, string> {
	const index = new Map<string, string>();
	for (const row of rows) {
		for (const lane of row.lanes) {
			for (const { item } of lane.bars) index.set(item.id, row.key);
		}
	}
	return index;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && pnpm test -- use-scheduler-rows
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck and format**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm typecheck && pnpm check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-scheduler-rows.ts apps/web/src/components/timeline/scheduler/use-scheduler-rows.test.ts
git commit -m "feat(web): add pure row-slice core for scheduler virtualization"
```

---

### Task 2: The `useSchedulerRows` hook

Wire `useVirtualizer` to the pure core. No test of its own — jsdom gives the virtualizer no real scroll geometry, so its behavior there is the fallback path, which Task 4 covers end to end. Correctness lives in Task 1.

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/use-scheduler-rows.ts`

**Interfaces:**
- Consumes: `sliceVisibleRows`, `RowWindow`, `SCHEDULER_OVERSCAN` from Task 1.
- Produces: `useSchedulerRows({ rows, scrollRef, pinnedKeys }): { visibleRows: SchedulerRow[] }`

- [ ] **Step 1: Add the hook**

Prepend these imports to `use-scheduler-rows.ts`:

```ts
import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useMemo } from "react";
```

Append to `use-scheduler-rows.ts`:

```ts
/**
 * Vertical windowing for the scheduler's two panes. Row sizes come straight
 * from `layoutScheduler`, so the virtualizer never measures the DOM.
 *
 * `pinnedKeys` names rows that must stay mounted even when scrolled out —
 * without them, the bar under an active drag would unmount mid-gesture.
 */
export function useSchedulerRows({
	rows,
	scrollRef,
	pinnedKeys,
}: {
	rows: SchedulerRow[];
	scrollRef: RefObject<HTMLDivElement | null>;
	pinnedKeys: ReadonlySet<string>;
}): { visibleRows: SchedulerRow[] } {
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (i) => rows[i].height,
		getItemKey: (i) => rows[i].key,
		overscan: SCHEDULER_OVERSCAN,
	});

	const virtualItems = virtualizer.getVirtualItems();
	// Until the scroll container has a measured height (initial mount, jsdom),
	// render every row rather than flashing an empty pane.
	const measured =
		virtualItems.length > 0 && (scrollRef.current?.clientHeight ?? 0) > 0;
	const first = measured ? virtualItems[0].index : null;
	const last = measured ? virtualItems[virtualItems.length - 1].index : null;

	const visibleRows = useMemo(() => {
		const window: RowWindow =
			first === null || last === null ? null : { first, last };
		return sliceVisibleRows(rows, window, pinnedKeys);
	}, [rows, first, last, pinnedKeys]);

	return { visibleRows };
}
```

Note `first`/`last` are memo dependencies rather than a freshly-allocated `window` object, which would defeat the memo on every render.

- [ ] **Step 2: Verify the existing scheduler tests still pass**

Nothing consumes the hook yet, so this only guards against an import-time or type error.

```bash
cd apps/web && pnpm test -- scheduler-view
```

Expected: PASS, 8 tests.

- [ ] **Step 3: Typecheck and format**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm typecheck && pnpm check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-scheduler-rows.ts
git commit -m "feat(web): add useSchedulerRows known-size virtualizer hook"
```

---

### Task 3: Absolutely position the group column

Pure refactor — still renders every row. Isolating it means a reviewer can judge the positioning change on its own, and if `sticky top-0` regresses, the culprit is unambiguous.

Today the group column stacks `GroupHeader` divs in normal flow, so skipping any row would collapse the layout. Each header gains an absolutely-positioned wrapper at `row.top`. `GroupHeader` itself is **not modified** — it keeps its own `height` and `border-b`, and its inner `sticky top-0` element keeps a normal-flow block parent, so sticky behavior is unchanged.

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx` (the group column, ~L273-283)

**Interfaces:**
- Consumes: `rows`, `totalHeight` from the existing `layoutScheduler` memo.
- Produces: nothing new.

- [ ] **Step 1: Replace the group column**

In `SchedulerLayoutInner`, replace:

```tsx
{!collapsed && (
	<div
		data-testid="scheduler-group-column"
		className="relative z-30 min-h-full shrink-0 border-r border-border bg-background-primary"
		style={{ width: tableWidth }}
	>
		{rows.map((row) => (
			<GroupHeader key={row.key} row={row} />
		))}
	</div>
)}
```

with:

```tsx
{!collapsed && (
	<div
		data-testid="scheduler-group-column"
		className="relative z-30 shrink-0 border-r border-border bg-background-primary"
		style={{ width: tableWidth, height: totalHeight }}
	>
		{rows.map((row) => (
			// Absolute wrapper so culled rows leave no gap. GroupHeader stays in
			// normal flow inside it, keeping its inner `sticky top-0` working.
			<div
				key={row.key}
				className="absolute inset-x-0"
				style={{ top: row.top }}
			>
				<GroupHeader row={row} />
			</div>
		))}
	</div>
)}
```

`min-h-full` is dropped because the column now carries an explicit `height`.

- [ ] **Step 2: Run the existing scheduler tests**

```bash
cd apps/web && pnpm test -- scheduler-view
```

Expected: PASS, 8 tests. In particular `renders per-assignee group headers from seed data` and `dragging a bar into another lane shows a drop target and reassigns it`.

- [ ] **Step 3: Verify sticky headers in the real app**

```bash
pnpm dev
```

Open a project's scheduler with at least one assignee whose row is taller than the viewport. Confirm: rows are not overlapping or collapsed, the assignee name stays pinned to the top of its row while scrolling through it, and the divider still drags.

If sticky is broken, add `height: row.height` to the wrapper and remove it from `GroupHeader` — but only if the simple form fails.

- [ ] **Step 4: Typecheck and format**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm typecheck && pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-layout.tsx
git commit -m "refactor(web): absolutely position scheduler group headers"
```

---

### Task 4: Wire virtualization into both panes

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx` (prop rename only)
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (append one test)

**Interfaces:**
- Consumes: `useSchedulerRows`, `buildItemRowIndex` from Tasks 1-2.
- Produces: `SchedulerLanes` now takes `visibleRows: SchedulerRow[]` instead of `rows`.

- [ ] **Step 1: Compute pinned keys and the visible slice**

In `scheduler-layout.tsx`, add to the imports:

```ts
import { buildItemRowIndex, useSchedulerRows } from "./use-scheduler-rows";
```

Insert immediately **after** `const scrollRef = scrollContainerRef;` (~L169) — it must come after `useBarDrag`, `useLaneCreate`, and `scrollRef` are all in scope:

```ts
const itemRowIndex = useMemo(() => buildItemRowIndex(rows), [rows]);

// Rows in a live gesture must stay mounted even when scrolled out of the
// window, or the bar under the cursor unmounts mid-drag.
const pinnedKeys = useMemo(() => {
	const keys = new Set<string>();
	if (dragDraft) {
		const origin = itemRowIndex.get(dragDraft.id);
		if (origin) keys.add(origin);
		if (dragDraft.targetLaneKey) keys.add(dragDraft.targetLaneKey);
	}
	if (createDraft) keys.add(createDraft.laneKey);
	if (renamingId) {
		const owner = itemRowIndex.get(renamingId);
		if (owner) keys.add(owner);
	}
	return keys;
}, [itemRowIndex, dragDraft, createDraft, renamingId]);

const { visibleRows } = useSchedulerRows({ rows, scrollRef, pinnedKeys });
```

- [ ] **Step 2: Render `visibleRows` in both panes**

In the group column from Task 3, change `{rows.map((row) => (` to `{visibleRows.map((row) => (`. Leave `style={{ ..., height: totalHeight }}` on the container — the scroll height must reflect *all* rows, not the rendered ones.

In the `<SchedulerLanes ... />` call, change `rows={rows}` to `visibleRows={visibleRows}`.

Leave `totalHeight={totalHeight}` as-is.

**Do not touch `resolveLaneAt`.** It closes over `rows` and must keep doing so.

- [ ] **Step 3: Rename the prop in `scheduler-lanes.tsx`**

Three edits, nothing else in the file changes:

1. In the destructured parameter list, `rows,` → `visibleRows,`
2. In the props type, `rows: SchedulerRow[];` → `visibleRows: SchedulerRow[];`
3. In the JSX body, `{rows.map((row) => (` → `{visibleRows.map((row) => (`

- [ ] **Step 4: Run the existing scheduler tests**

```bash
cd apps/web && pnpm test -- scheduler-view
```

Expected: PASS, 8 tests, **unmodified**. They pass through the render-all fallback: the file's `MockResizeObserver` gives the virtualizer a rect, but jsdom leaves `clientHeight` at `0`, so `measured` is `false` and `sliceVisibleRows` returns `rows` unchanged.

A failure here means the fallback is wrong. Fix the fallback; do not edit the tests.

- [ ] **Step 5: Write the windowing integration test**

Append to the `describe("SchedulerView", ...)` block in `scheduler-view.test.tsx`:

```tsx
	it("culls offscreen assignee rows once the viewport is measured", () => {
		// jsdom reports clientHeight 0, which trips the render-all fallback.
		// Stub a real height so the virtualizer produces a window.
		const proto = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"clientHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "clientHeight", {
			configurable: true,
			get: () => 120,
		});
		try {
			renderScheduler();
			const headers = screen.getAllByTestId("scheduler-group-header");
			const total = new Set(seedItems.map((i) => i.assignee?.id)).size;
			expect(headers.length).toBeLessThan(total);
		} finally {
			if (proto) {
				Object.defineProperty(HTMLElement.prototype, "clientHeight", proto);
			}
		}
	});
```

- [ ] **Step 6: Run the new test**

```bash
cd apps/web && pnpm test -- scheduler-view
```

Expected: PASS, 9 tests.

**If this test cannot be made to pass** because `@tanstack/react-virtual` declines to produce a window under jsdom's synthetic scroll geometry, **delete it rather than fight it.** The pure tests in Task 1 carry the correctness argument; this one only verifies wiring, and Step 7 verifies wiring far more convincingly. Note the deletion in the commit message.

- [ ] **Step 7: Verify in the real app**

```bash
pnpm dev
```

Seed a large project (`cd apps/api && pnpm tsx src/db/seed-bulk-org.ts`, then `seed-bulk-tasks.ts`), open its scheduler, and confirm:

1. Scrolling is smooth, and DevTools' Elements panel shows rows entering and leaving the DOM.
2. No blank gaps appear during a fast scroll or flick. If they do, raise `SCHEDULER_OVERSCAN` from `2` to `3` or `4` and re-check.
3. **Drag a bar from a top row far down past the viewport edge.** The bar must stay visible the whole way and drop into the target lane. This exercises both pins.
4. Drag on an empty area of a row to create a task, then scroll during the inline rename — the rename input must not unmount.
5. The assignee name still sticks to the top of tall rows.

- [ ] **Step 8: Typecheck and format**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm typecheck && pnpm check
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "perf(web): virtualize scheduler rows"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| `use-scheduler-rows.ts`, known-size virtualizer, overscan 2 | 1, 2 |
| Unmeasured-viewport render-all fallback | 2, verified in 4.4 |
| Pinned rows (4 sources), re-ordered by row index | 1 (`sliceVisibleRows` filter), 4.1 |
| `itemId → rowKey` memoized index | 1, 4.1 |
| Group column absolutely positioned, `sticky` preserved via wrapper | 3 |
| Both panes map `visibleRows` | 4.2 |
| `resolveLaneAt` keeps full `rows` | Constraint + 4.2 |
| `scheduler-lanes.tsx` prop rename only | 4.3 |
| 8 existing tests pass unmodified | 4.4 |
| `use-scheduler-rows.test.ts` unit tests | 1 |
| Windowing integration test | 4.5 |
| Vitest scoped to single files | every test step |

**Deviation from spec, deliberate:** the spec said `GroupHeader` would stop setting its own `height`, with the wrapper carrying it. Task 3 leaves `GroupHeader` completely untouched and gives the wrapper only `top`. This is strictly less churn and preserves the sticky parent relationship more obviously. The spec's version is retained as the fallback in Task 3 Step 3.

**Deviation from spec, deliberate:** the spec framed the unit test as a pure function of `(rows, scrollTop, viewportHeight, pinnedKeys)`. That would require simulating the virtualizer. Task 1 instead tests `(rows, window, pinnedKeys)` — the virtualizer's *output* is the input — which is the real seam and needs no simulation.

**Type consistency:** `sliceVisibleRows`, `buildItemRowIndex`, `RowWindow`, `SCHEDULER_OVERSCAN`, `useSchedulerRows`, and the `visibleRows` prop are named identically in Tasks 1, 2, and 4. `createDraft.laneKey` matches `LaneCreateDraft`; `dragDraft.id` and `dragDraft.targetLaneKey` match `useBarDrag`'s draft type as consumed at `scheduler-lanes.tsx:131-142`.

**Placeholder scan:** none. Every code step carries the code.
