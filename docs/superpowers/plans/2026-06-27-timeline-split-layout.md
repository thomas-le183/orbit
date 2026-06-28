# Timeline Split Layout (Shared Shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resizable **table | timeline** split layout to `apps/web` where the table column and the existing `ItemsLayer` share one vertical scroll and align row-for-row.

**Architecture:** A `SplitLayout` shell wraps the existing timeline body (`ItemsLayer`) instead of rebuilding it. A left table column and `ItemsLayer` sit inside one shared vertical-scroll container, both laying rows out at `rowIndex × ROW_HEIGHT` from a shared `row-metrics` module, so they can never drift. A custom draggable divider sets the table width; `viewportWidth` is measured from the timeline (right) region. The date axis, grid, now-line stay pinned; the horizontal scrollbar stays in the footer.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + happy-dom + Testing Library, `@orbit/ui`, `@orbit/shared` (`cn`).

## Global Constraints

- **Package manager:** `pnpm`. Run web commands from `apps/web` (`cd apps/web`).
- **Tests:** Vitest. Run a single file with `pnpm test <path-substring>`. Import `describe/it/expect` from `vitest`.
- **Imports:** `@/*` alias → `apps/web/src/*` for app-absolute imports; relative imports within the `timeline/` folder for siblings. UI from `@orbit/ui/components/<name>`. `cn` from `@orbit/shared`.
- **TypeScript:** camelCase functions, PascalCase types/components. No `any`.
- **Styling:** Tailwind v4 utilities; `cn()` for conditional classes.
- **Branch:** `feat/timeline-calendar-axis` (already checked out). Commit after every task.
- **No `react-resizable-panels`** for this shell — single shared scroll + custom divider.
- **Alignment metric:** table and `ItemsLayer` MUST both use `ROW_HEIGHT`/`ROW_PADDING`/`contentHeight` from the shared `row-metrics` module.
- **Constants:** `ROW_HEIGHT = 40`, `ROW_PADDING = 7`, `DEFAULT_TABLE_WIDTH = 320`, `MIN_TABLE_WIDTH = 160`, `MAX_TABLE_WIDTH = 640`.

---

## File Structure

Under `apps/web/src/components/timeline/layout/` (new):

```
layout/row-metrics.ts            ROW_HEIGHT, ROW_PADDING, contentHeight(rowCount)
layout/divider.ts                table-width constants + clampTableWidth(px,min,max)
layout/use-resizable-divider.ts  pointer-drag hook → { tableWidth, onDividerPointerDown }
layout/timeline-table.tsx        demo left-table (reads useTimelineItems + layoutItems)
layout/split-layout.tsx          the shell: header band + shared-scroll body + divider + footer
```

Modified:
```
items-layer.tsx                  import ROW_HEIGHT/ROW_PADDING from row-metrics (was local)
routes/_workspace/$orgSlug/timeline.tsx   render SplitLayout demo instead of TimelineContainer
```

---

### Task 1: Shared row metrics + divider math (pure)

**Files:**
- Create: `apps/web/src/components/timeline/layout/row-metrics.ts`
- Create: `apps/web/src/components/timeline/layout/divider.ts`
- Modify: `apps/web/src/components/timeline/items-layer.tsx` (use shared metrics)
- Test: `apps/web/src/components/timeline/layout/divider.test.ts`

**Interfaces:**
- Produces:
  - `row-metrics.ts`: `ROW_HEIGHT = 40`, `ROW_PADDING = 7`, `contentHeight(rowCount: number): number`
  - `divider.ts`: `DEFAULT_TABLE_WIDTH = 320`, `MIN_TABLE_WIDTH = 160`, `MAX_TABLE_WIDTH = 640`, `clampTableWidth(px: number, min?: number, max?: number): number`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/layout/divider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	clampTableWidth,
	MAX_TABLE_WIDTH,
	MIN_TABLE_WIDTH,
} from "./divider";
import { contentHeight, ROW_HEIGHT, ROW_PADDING } from "./row-metrics";

describe("clampTableWidth", () => {
	it("passes through an in-range value", () => {
		expect(clampTableWidth(320)).toBe(320);
	});
	it("clamps below the minimum", () => {
		expect(clampTableWidth(10)).toBe(MIN_TABLE_WIDTH);
	});
	it("clamps above the maximum", () => {
		expect(clampTableWidth(9999)).toBe(MAX_TABLE_WIDTH);
	});
	it("honors explicit bounds", () => {
		expect(clampTableWidth(50, 100, 200)).toBe(100);
	});
});

describe("contentHeight", () => {
	it("is rowCount * ROW_HEIGHT + ROW_PADDING", () => {
		expect(contentHeight(5)).toBe(5 * ROW_HEIGHT + ROW_PADDING);
	});
	it("is just the padding for zero rows", () => {
		expect(contentHeight(0)).toBe(ROW_PADDING);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/layout/divider.test.ts`
Expected: FAIL — cannot resolve `./divider` / `./row-metrics`.

- [ ] **Step 3: Write row-metrics**

Create `apps/web/src/components/timeline/layout/row-metrics.ts`:

```ts
/** Vertical pixels allotted to one timeline row (table cell and bar lane). */
export const ROW_HEIGHT = 40;
/** Padding trimmed off the top of the stacked rows / bars. */
export const ROW_PADDING = 7;

/** Total stacked height of `rowCount` rows, matching ItemsLayer's content height. */
export const contentHeight = (rowCount: number): number =>
	rowCount * ROW_HEIGHT + ROW_PADDING;
```

- [ ] **Step 4: Write divider**

Create `apps/web/src/components/timeline/layout/divider.ts`:

```ts
export const DEFAULT_TABLE_WIDTH = 320;
export const MIN_TABLE_WIDTH = 160;
export const MAX_TABLE_WIDTH = 640;

/** Clamp a proposed table width to the allowed range. */
export const clampTableWidth = (
	px: number,
	min: number = MIN_TABLE_WIDTH,
	max: number = MAX_TABLE_WIDTH,
): number => Math.min(Math.max(px, min), max);
```

- [ ] **Step 5: Refactor items-layer to use shared metrics**

In `apps/web/src/components/timeline/items-layer.tsx`, remove the local constants:

```ts
const ROW_HEIGHT = 40;
const ROW_PADDING = 7;
```

and import them instead (add to the existing import block near the top, after the other relative imports):

```ts
import { ROW_HEIGHT, ROW_PADDING } from "./layout/row-metrics";
```

Leave all other usage of `ROW_HEIGHT` / `ROW_PADDING` in the file unchanged.

- [ ] **Step 6: Run tests + typecheck**

Run: `cd apps/web && pnpm test src/components/timeline/layout/divider.test.ts && pnpm test src/components/timeline/items-layer && pnpm typecheck`
Expected: divider tests PASS; existing items-layer test(s) still PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/layout/row-metrics.ts apps/web/src/components/timeline/layout/divider.ts apps/web/src/components/timeline/layout/divider.test.ts apps/web/src/components/timeline/items-layer.tsx
git commit -m "feat(timeline): extract shared row metrics + table-width clamp"
```

---

### Task 2: Resizable divider hook

**Files:**
- Create: `apps/web/src/components/timeline/layout/use-resizable-divider.ts`
- Test: `apps/web/src/components/timeline/layout/use-resizable-divider.test.ts`

**Interfaces:**
- Consumes: `clampTableWidth`, `DEFAULT_TABLE_WIDTH` from `./divider`.
- Produces: `useResizableDivider(initialWidth?: number): { tableWidth: number; onDividerPointerDown: (e: React.PointerEvent) => void }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/layout/use-resizable-divider.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MAX_TABLE_WIDTH } from "./divider";
import { useResizableDivider } from "./use-resizable-divider";

// Minimal React.PointerEvent stand-in carrying the fields the hook reads.
function pointerDownAt(clientX: number) {
	return {
		clientX,
		preventDefault() {},
	} as unknown as React.PointerEvent;
}

describe("useResizableDivider", () => {
	it("starts at the initial width", () => {
		const { result } = renderHook(() => useResizableDivider(320));
		expect(result.current.tableWidth).toBe(320);
	});

	it("widens as the pointer moves right", () => {
		const { result } = renderHook(() => useResizableDivider(320));
		act(() => result.current.onDividerPointerDown(pointerDownAt(400)));
		act(() => {
			window.dispatchEvent(new MouseEvent("pointermove", { clientX: 460 }));
		});
		expect(result.current.tableWidth).toBe(380); // 320 + (460 - 400)
		act(() => window.dispatchEvent(new MouseEvent("pointerup")));
	});

	it("clamps at the maximum", () => {
		const { result } = renderHook(() => useResizableDivider(320));
		act(() => result.current.onDividerPointerDown(pointerDownAt(0)));
		act(() => {
			window.dispatchEvent(new MouseEvent("pointermove", { clientX: 5000 }));
		});
		expect(result.current.tableWidth).toBe(MAX_TABLE_WIDTH);
		act(() => window.dispatchEvent(new MouseEvent("pointerup")));
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/layout/use-resizable-divider.test.ts`
Expected: FAIL — cannot resolve `./use-resizable-divider`.

- [ ] **Step 3: Write the hook**

Create `apps/web/src/components/timeline/layout/use-resizable-divider.ts`:

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { clampTableWidth, DEFAULT_TABLE_WIDTH } from "./divider";

/** Drag-to-resize state for the table | timeline divider. */
export function useResizableDivider(initialWidth: number = DEFAULT_TABLE_WIDTH): {
	tableWidth: number;
	onDividerPointerDown: (e: ReactPointerEvent) => void;
} {
	const [tableWidth, setTableWidth] = useState(initialWidth);
	const startX = useRef(0);
	const startWidth = useRef(0);

	const onDividerPointerDown = (e: ReactPointerEvent) => {
		e.preventDefault();
		startX.current = e.clientX;
		startWidth.current = tableWidth;

		const onMove = (ev: PointerEvent) => {
			const next = startWidth.current + (ev.clientX - startX.current);
			setTableWidth(clampTableWidth(next));
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	return { tableWidth, onDividerPointerDown };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/layout/use-resizable-divider.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/layout/use-resizable-divider.ts apps/web/src/components/timeline/layout/use-resizable-divider.test.ts
git commit -m "feat(timeline): add resizable divider hook"
```

---

### Task 3: Demo table column

**Files:**
- Create: `apps/web/src/components/timeline/layout/timeline-table.tsx`
- Test: `apps/web/src/components/timeline/layout/timeline-table.test.tsx`

**Interfaces:**
- Consumes: `useTimelineItems` from `../use-timeline-items`; `layoutItems`, `RenderRow` from `../controller/layout`; `ROW_HEIGHT`, `ROW_PADDING`, `contentHeight` from `./row-metrics`; `useTimelineController` from `../controller/context` (for `today`); `cn` from `@orbit/shared`.
- Produces:
  - default export `TimelineTable` (the left column body)
  - named export `TimelineTableHeader` (the titles row for the header band)

Background facts (verified):
- `useTimelineItems()` returns `{ items, updateItem, moveDays }`.
- `layoutItems(items, today)` returns `{ rows, containers }`; `rows: RenderRow[]` where `RenderRow = { item, depth, range, rowIndex, isParent }`.
- `item` has `name`, `color`, `startDate`, `endDate`, optional `assignee?: { name }`.
- `useTimelineController()` exposes `today`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/layout/timeline-table.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineProvider } from "../controller/context";
import TimelineTable from "./timeline-table";

describe("TimelineTable", () => {
	it("renders one row cell per timeline item row", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<TimelineTable />
			</TimelineProvider>,
		);
		const cells = container.querySelectorAll(
			"[data-testid='timeline-table-row']",
		);
		expect(cells.length).toBeGreaterThan(0);
	});

	it("positions each row by its rowIndex (first row at the top padding)", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<TimelineTable />
			</TimelineProvider>,
		);
		const first = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		// ROW_PADDING = 7 → first row's top is 7px
		expect(first?.style.top).toBe("7px");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/layout/timeline-table.test.tsx`
Expected: FAIL — cannot resolve `./timeline-table`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/timeline/layout/timeline-table.tsx`:

```tsx
import { cn } from "@orbit/shared";
import { useMemo } from "react";
import { useTimelineController } from "../controller/context";
import { layoutItems } from "../controller/layout";
import { useTimelineItems } from "../use-timeline-items";
import { contentHeight, ROW_HEIGHT, ROW_PADDING } from "./row-metrics";

/** Column titles for the header band, left of the date axis. */
export function TimelineTableHeader() {
	return (
		<div className="flex h-full items-center gap-2 px-3 text-xs font-semibold text-muted-foreground">
			<span className="flex-1">Name</span>
			<span className="w-24 shrink-0">Assignee</span>
			<span className="w-28 shrink-0">Dates</span>
		</div>
	);
}

/** Left table column: one cell per timeline row, aligned to ItemsLayer rows. */
export default function TimelineTable() {
	const { today } = useTimelineController();
	const { items } = useTimelineItems();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);

	return (
		<div className="relative w-full" style={{ height: contentHeight(rows.length) }}>
			{rows.map((row) => {
				const top = row.rowIndex * ROW_HEIGHT + ROW_PADDING;
				const { item } = row;
				return (
					<div
						key={item.id}
						data-testid="timeline-table-row"
						className="absolute inset-x-0 flex items-center gap-2 px-3 text-xs"
						style={{ top, height: ROW_HEIGHT - ROW_PADDING * 2 }}
					>
						<span
							className="flex min-w-0 flex-1 items-center gap-1.5"
							style={{ paddingLeft: row.depth * 14 }}
						>
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span
								className={cn(
									"truncate",
									row.isParent ? "font-semibold text-foreground" : "text-foreground",
								)}
							>
								{item.name}
							</span>
						</span>
						<span className="w-24 shrink-0 truncate text-muted-foreground">
							{item.assignee?.name ?? ""}
						</span>
						<span className="w-28 shrink-0 truncate text-muted-foreground">
							{item.startDate} → {item.endDate}
						</span>
					</div>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/layout/timeline-table.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/layout/timeline-table.tsx apps/web/src/components/timeline/layout/timeline-table.test.tsx
git commit -m "feat(timeline): add demo table column aligned to timeline rows"
```

---

### Task 4: SplitLayout shell + route wiring

**Files:**
- Create: `apps/web/src/components/timeline/layout/split-layout.tsx`
- Modify: `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx`
- Test: `apps/web/src/components/timeline/layout/split-layout.test.tsx`

**Interfaces:**
- Consumes: `TimelineProvider`, `useTimelineController` from `../controller/context`; `useResizableDivider` from `./use-resizable-divider`; `TimelineGrid` from `../axis/grid`; `TimeUnitsBar` from `../header/time-units-bar`; `NowLine` from `../now-line`; `TimelineScrollbar` from `../scrollbar`; `ItemsLayer` from `../items-layer`; `usePan` from `../use-pan`; `usePreferences` from `@/hooks/use-preferences`; `TimelineTable`, `TimelineTableHeader` from `./timeline-table`; `useResizeObserver` from `usehooks-ts`.
- Produces: default export `SplitLayout` (props per spec §3: `{ tableHeader, table, initialTableWidth? }`), and a default-export demo wrapper wired in the route.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/layout/split-layout.test.tsx`:

```tsx
import { fireEvent, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import SplitLayout from "./split-layout";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

// Right region measures width via useResizeObserver; happy-dom emits no size,
// so mock ResizeObserver to fire once at 800px.
const realResizeObserver = globalThis.ResizeObserver;
beforeAll(() => {
	class MockResizeObserver {
		private cb: ResizeObserverCallback;
		constructor(cb: ResizeObserverCallback) {
			this.cb = cb;
		}
		observe(target: Element) {
			this.cb(
				[
					{ target, contentRect: { width: 800, height: 400 } },
				] as unknown as ResizeObserverEntry[],
				this as unknown as ResizeObserver,
			);
		}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver =
		MockResizeObserver as unknown as typeof ResizeObserver;
});
afterAll(() => {
	globalThis.ResizeObserver = realResizeObserver;
});

import SplitLayout from "./split-layout";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

function renderShell() {
	return render(
		<SplitLayout
			tableHeader={<TimelineTableHeader />}
			table={<TimelineTable />}
		/>,
	);
}

describe("SplitLayout", () => {
	it("renders the date axis, the table column, the items layer, and the divider", () => {
		const { container } = renderShell();
		expect(
			container.querySelector("[data-testid='timeline-header-top']"),
		).not.toBeNull();
		expect(
			container.querySelectorAll("[data-testid='timeline-table-row']").length,
		).toBeGreaterThan(0);
		expect(
			container.querySelector("[data-testid='timeline-items-content']"),
		).not.toBeNull();
		expect(
			container.querySelector("[data-testid='timeline-split-divider']"),
		).not.toBeNull();
	});

	it("widens the table column when the divider is dragged right", () => {
		const { container } = renderShell();
		const divider = container.querySelector<HTMLElement>(
			"[data-testid='timeline-split-divider']",
		);
		const col = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-column']",
		);
		if (!divider || !col) throw new Error("missing divider/column");
		const before = Number.parseFloat(col.style.width);
		fireEvent.pointerDown(divider, { clientX: 320 });
		fireEvent.pointerMove(window, { clientX: 400 });
		fireEvent.pointerUp(window);
		const after = Number.parseFloat(col.style.width);
		expect(after).toBeGreaterThan(before);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/layout/split-layout.test.tsx`
Expected: FAIL — cannot resolve `./split-layout`.

- [ ] **Step 3: Write the shell**

Create `apps/web/src/components/timeline/layout/split-layout.tsx`:

```tsx
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "../header/time-units-bar";
import ItemsLayer from "../items-layer";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { usePan } from "../use-pan";
import { useResizableDivider } from "./use-resizable-divider";

type SplitLayoutProps = {
	tableHeader: ReactNode;
	table: ReactNode;
	initialTableWidth?: number;
};

function SplitLayoutInner({ tableHeader, table, initialTableWidth }: SplitLayoutProps) {
	const { setViewportWidth } = useTimelineController();
	const { tableWidth, onDividerPointerDown } = useResizableDivider(initialTableWidth);
	const { onWheel } = usePan();

	// Measure the timeline (right) region so viewportWidth excludes the table column.
	const rightRef = useRef<HTMLDivElement>(null);
	const { width = 0 } = useResizeObserver({
		ref: rightRef as RefObject<HTMLDivElement>,
	});
	useEffect(() => {
		setViewportWidth(width);
	}, [width, setViewportWidth]);

	return (
		<div className="relative flex h-full flex-col">
			{/* header band */}
			<div className="flex h-12 shrink-0 border-b border-border">
				<div className="shrink-0 border-r border-border" style={{ width: tableWidth }}>
					{tableHeader}
				</div>
				<div className="relative flex-1">
					<TimeUnitsBar />
				</div>
			</div>

			{/* body */}
			<div className="relative flex-1 overflow-hidden">
				{/* pinned timeline background over the right region */}
				<div className="absolute inset-y-0 right-0" style={{ left: tableWidth }}>
					<TimelineGrid />
					<NowLine />
				</div>
				{/* shared vertical scroll: table column + items layer move together */}
				<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
					<div className="flex">
						<div
							data-testid="timeline-table-column"
							className="shrink-0 border-r border-border"
							style={{ width: tableWidth }}
						>
							{table}
						</div>
						<div
							ref={rightRef}
							className="relative flex-1 touch-none select-none"
							onWheel={onWheel}
						>
							<ItemsLayer />
						</div>
					</div>
				</div>
			</div>

			{/* full-height draggable divider */}
			<div
				data-testid="timeline-split-divider"
				onPointerDown={onDividerPointerDown}
				className="absolute inset-y-0 z-30 w-1 -translate-x-1/2 cursor-col-resize hover:bg-border"
				style={{ left: tableWidth }}
			/>

			{/* footer: horizontal scrollbar under the timeline region only */}
			<div className="flex shrink-0">
				<div className="shrink-0" style={{ width: tableWidth }} />
				<div className="relative flex-1">
					<TimelineScrollbar />
				</div>
			</div>
		</div>
	);
}

export default function SplitLayout(props: SplitLayoutProps) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<SplitLayoutInner {...props} />
		</TimelineProvider>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/layout/split-layout.test.tsx`
Expected: PASS (2 tests).

Note: `SplitLayout` calls `usePreferences()` (a React Query hook), so the test renders it without a QueryClient. If the test errors with "No QueryClient set", wrap `renderShell`'s render in a `QueryClientProvider` exactly as in `apps/web/src/components/timeline/container/index.test.tsx` (import `QueryClient`, `QueryClientProvider` from `@tanstack/react-query`, `new QueryClient({ defaultOptions: { queries: { retry: false } } })`). Add that wrapper, then re-run.

- [ ] **Step 5: Wire the route**

Replace the contents of `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import SplitLayout from "@/components/timeline/layout/split-layout";
import TimelineTable, {
	TimelineTableHeader,
} from "@/components/timeline/layout/timeline-table";

export const Route = createFileRoute("/_workspace/$orgSlug/timeline")({
	component: TimelinePage,
});

function TimelinePage() {
	return (
		<div className="h-full">
			<SplitLayout
				tableHeader={<TimelineTableHeader />}
				table={<TimelineTable />}
			/>
		</div>
	);
}
```

- [ ] **Step 6: Full suite + typecheck + lint**

Run: `cd apps/web && pnpm test src/components/timeline && pnpm typecheck`
Expected: all timeline tests PASS; no type errors.

Run: `cd /Users/thinhle/Documents/Development/orbit && npx @biomejs/biome check --write apps/web/src/components/timeline/layout apps/web/src/components/timeline/items-layer.tsx apps/web/src/routes/_workspace/\$orgSlug/timeline.tsx`
Then re-run the timeline suite to confirm formatting changes didn't break anything:
`cd apps/web && pnpm test src/components/timeline`
Expected: Biome reports no remaining errors in these files; tests still PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/layout/split-layout.test.tsx apps/web/src/routes/_workspace/\$orgSlug/timeline.tsx
git commit -m "feat(timeline): add resizable table | timeline split layout and wire route"
```

---

## Manual verification (after Task 4)

- [ ] `cd apps/web && pnpm dev`, open the workspace timeline route.
- [ ] Confirm a left table column (Name/Assignee/Dates) sits beside the timeline; rows line up with the bars.
- [ ] Scroll vertically — the table and bars scroll together; the date axis, grid, now-line stay pinned; the horizontal scrollbar stays in the footer.
- [ ] Drag the divider — the table column widens/narrows (clamped 160–640) and the timeline reflows.
- [ ] Wheel/arrow-key horizontal pan still moves the timeline; the table stays put horizontally.
