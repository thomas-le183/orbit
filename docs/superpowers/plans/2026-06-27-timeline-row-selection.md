# Timeline Row Selection & Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk row selection (click, shift-range, per-row + select-all checkboxes, Esc-to-clear) and row hover to the timeline, highlighted in lockstep across the table and the timeline bars.

**Architecture:** A dedicated `RowSelectionProvider` holds `selectedIds`/`hoveredId`/`anchorId` and is consumed by both `timeline-table` and `items-layer` via `useRowSelection()`. Range math is a pure helper (`selection/range.ts`). The context has a **no-op default value**, so components render fine without the provider (selection simply disabled) and existing tests keep passing.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + happy-dom + Testing Library + user-event, `@orbit/ui` (`Checkbox`), `@orbit/shared` (`cn`).

## Global Constraints

- **Package manager:** `pnpm`. Run web commands from `apps/web` (`cd apps/web`).
- **Tests:** Vitest. Single file: `pnpm test <path-substring>`. Import `describe/it/expect` from `vitest`.
- **Imports:** `@/*` alias → `apps/web/src/*`; relative within the `timeline/` folder; UI from `@orbit/ui/components/<name>`; `cn` from `@orbit/shared`.
- **TypeScript:** camelCase functions, PascalCase types/components. No `any`.
- **Styling:** Tailwind v4; `cn()` for conditional classes. Selected → `bg-accent`; hovered (not selected) → `bg-muted/50`.
- **Branch:** `main` (current). Commit after every task. Do NOT switch branches.
- **The context default is a no-op value** (empty selection, no-op actions) so consumers work without the provider.
- **Row metric:** reuse `ROW_HEIGHT` / `rowTop` from `layout/row-metrics`.

---

## File Structure

New (`apps/web/src/components/timeline/selection/`):
```
selection/range.ts        rangeIds(orderedIds, anchorId, targetId) — pure inclusive range
selection/context.tsx     RowSelectionProvider, useRowSelection (no-op default)
```
Modified:
```
layout/timeline-table.tsx   checkbox column, row click/shift/hover, selected/hover classes
items-layer.tsx             row-band layer; bar/milestone hover + click selection
layout/split-layout.tsx     wrap children in RowSelectionProvider; Esc-to-clear
```

---

### Task 1: Pure range helper

**Files:**
- Create: `apps/web/src/components/timeline/selection/range.ts`
- Test: `apps/web/src/components/timeline/selection/range.test.ts`

**Interfaces:**
- Produces: `rangeIds(orderedIds: string[], anchorId: string | null, targetId: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/selection/range.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rangeIds } from "./range";

const IDS = ["a", "b", "c", "d", "e"];

describe("rangeIds", () => {
	it("returns the inclusive range when anchor is before target", () => {
		expect(rangeIds(IDS, "b", "d")).toEqual(["b", "c", "d"]);
	});
	it("returns the inclusive range when anchor is after target", () => {
		expect(rangeIds(IDS, "d", "b")).toEqual(["b", "c", "d"]);
	});
	it("returns just the target when there is no anchor", () => {
		expect(rangeIds(IDS, null, "c")).toEqual(["c"]);
	});
	it("returns a single id when anchor equals target", () => {
		expect(rangeIds(IDS, "c", "c")).toEqual(["c"]);
	});
	it("returns just the target when the anchor is not in the list", () => {
		expect(rangeIds(IDS, "z", "c")).toEqual(["c"]);
	});
	it("returns empty when the target is not in the list", () => {
		expect(rangeIds(IDS, "a", "z")).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/selection/range.test.ts`
Expected: FAIL — cannot resolve `./range`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/timeline/selection/range.ts`:

```ts
/**
 * Inclusive id range between `anchorId` and `targetId` within `orderedIds`.
 * - target not found → `[]`
 * - anchor null or not found → `[targetId]`
 * - order-independent (anchor may sit before or after target)
 */
export function rangeIds(
	orderedIds: string[],
	anchorId: string | null,
	targetId: string,
): string[] {
	const targetIdx = orderedIds.indexOf(targetId);
	if (targetIdx === -1) return [];
	const anchorIdx = anchorId === null ? -1 : orderedIds.indexOf(anchorId);
	if (anchorIdx === -1) return [targetId];
	const lo = Math.min(anchorIdx, targetIdx);
	const hi = Math.max(anchorIdx, targetIdx);
	return orderedIds.slice(lo, hi + 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/selection/range.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/selection/range.ts apps/web/src/components/timeline/selection/range.test.ts
git commit -m "feat(timeline): add pure rangeIds helper for shift-range selection"
```

---

### Task 2: RowSelectionProvider + hook

**Files:**
- Create: `apps/web/src/components/timeline/selection/context.tsx`
- Test: `apps/web/src/components/timeline/selection/context.test.tsx`

**Interfaces:**
- Consumes: `rangeIds` from `./range`.
- Produces:
  - `type RowSelectionValue = { selectedIds: ReadonlySet<string>; hoveredId: string | null; isSelected: (id: string) => boolean; selectOne: (id: string) => void; selectTo: (id: string, orderedIds: string[]) => void; toggle: (id: string) => void; selectAll: (orderedIds: string[]) => void; clear: () => void; setHovered: (id: string | null) => void; }`
  - `RowSelectionProvider: React.FC<{ children: React.ReactNode }>`
  - `useRowSelection(): RowSelectionValue`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/selection/context.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RowSelectionProvider, useRowSelection } from "./context";

const IDS = ["a", "b", "c", "d"];
const wrapper = ({ children }: { children: ReactNode }) => (
	<RowSelectionProvider>{children}</RowSelectionProvider>
);

describe("useRowSelection", () => {
	it("selectOne replaces the selection and sets the anchor", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectOne("b"));
		expect([...result.current.selectedIds]).toEqual(["b"]);
		act(() => result.current.selectOne("c"));
		expect([...result.current.selectedIds]).toEqual(["c"]);
	});

	it("selectTo selects the inclusive range from the anchor", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectOne("b"));
		act(() => result.current.selectTo("d", IDS));
		expect([...result.current.selectedIds].sort()).toEqual(["b", "c", "d"]);
	});

	it("toggle adds then removes an id", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.toggle("a"));
		expect(result.current.isSelected("a")).toBe(true);
		act(() => result.current.toggle("a"));
		expect(result.current.isSelected("a")).toBe(false);
	});

	it("selectAll selects everything, then clears when all are selected", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectAll(IDS));
		expect(result.current.selectedIds.size).toBe(4);
		act(() => result.current.selectAll(IDS));
		expect(result.current.selectedIds.size).toBe(0);
	});

	it("clear empties the selection; setHovered tracks the hovered id", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectOne("a"));
		act(() => result.current.clear());
		expect(result.current.selectedIds.size).toBe(0);
		act(() => result.current.setHovered("c"));
		expect(result.current.hoveredId).toBe("c");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/selection/context.test.tsx`
Expected: FAIL — cannot resolve `./context`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/timeline/selection/context.tsx`:

```tsx
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { rangeIds } from "./range";

export type RowSelectionValue = {
	selectedIds: ReadonlySet<string>;
	hoveredId: string | null;
	isSelected: (id: string) => boolean;
	selectOne: (id: string) => void;
	selectTo: (id: string, orderedIds: string[]) => void;
	toggle: (id: string) => void;
	selectAll: (orderedIds: string[]) => void;
	clear: () => void;
	setHovered: (id: string | null) => void;
};

const EMPTY: ReadonlySet<string> = new Set();

/** No-op default so consumers render without a provider (selection disabled). */
const NOOP: RowSelectionValue = {
	selectedIds: EMPTY,
	hoveredId: null,
	isSelected: () => false,
	selectOne: () => {},
	selectTo: () => {},
	toggle: () => {},
	selectAll: () => {},
	clear: () => {},
	setHovered: () => {},
};

const RowSelectionContext = createContext<RowSelectionValue>(NOOP);

export function RowSelectionProvider({ children }: { children: ReactNode }) {
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(EMPTY);
	const [anchorId, setAnchorId] = useState<string | null>(null);
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	const selectOne = useCallback((id: string) => {
		setSelectedIds(new Set([id]));
		setAnchorId(id);
	}, []);

	const selectTo = useCallback(
		(id: string, orderedIds: string[]) => {
			setSelectedIds(new Set(rangeIds(orderedIds, anchorId, id)));
			// anchor stays put so further shift-clicks extend from the same origin
		},
		[anchorId],
	);

	const toggle = useCallback((id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
		setAnchorId(id);
	}, []);

	const selectAll = useCallback((orderedIds: string[]) => {
		setSelectedIds((prev) => {
			const allSelected =
				orderedIds.length > 0 && orderedIds.every((id) => prev.has(id));
			return allSelected ? new Set() : new Set(orderedIds);
		});
	}, []);

	const clear = useCallback(() => {
		setSelectedIds(EMPTY);
		setAnchorId(null);
	}, []);

	const setHovered = useCallback((id: string | null) => setHoveredId(id), []);

	const value = useMemo<RowSelectionValue>(
		() => ({
			selectedIds,
			hoveredId,
			isSelected: (id: string) => selectedIds.has(id),
			selectOne,
			selectTo,
			toggle,
			selectAll,
			clear,
			setHovered,
		}),
		[selectedIds, hoveredId, selectOne, selectTo, toggle, selectAll, clear, setHovered],
	);

	return (
		<RowSelectionContext.Provider value={value}>
			{children}
		</RowSelectionContext.Provider>
	);
}

export function useRowSelection(): RowSelectionValue {
	return useContext(RowSelectionContext);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/selection/context.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/selection/context.tsx apps/web/src/components/timeline/selection/context.test.tsx
git commit -m "feat(timeline): add RowSelectionProvider for shared selection/hover state"
```

---

### Task 3: Table selection UI (checkboxes, click, shift, hover)

**Files:**
- Modify: `apps/web/src/components/timeline/layout/timeline-table.tsx`
- Test: `apps/web/src/components/timeline/layout/timeline-table.test.tsx` (add cases)

**Interfaces:**
- Consumes: `useRowSelection` from `../selection/context`; `Checkbox` from `@orbit/ui/components/checkbox`; existing `useTimelineController`, `useTimelineItems`, `layoutItems`, `rowTop`, `ROW_HEIGHT`, `ROW_PADDING`, `contentHeight`, `cn`.
- Produces: updated `TimelineTable` (rows selectable) and `TimelineTableHeader` (select-all checkbox).

Background (verified): `Checkbox` (BaseUI) takes `checked: boolean` and `onCheckedChange: (checked: boolean) => void`, renders `role="checkbox"`. `RenderRow = { item, depth, range, rowIndex, isParent }`.

- [ ] **Step 1: Write the failing test (append to the existing describe)**

Replace the contents of `apps/web/src/components/timeline/layout/timeline-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TimelineProvider } from "../controller/context";
import { RowSelectionProvider } from "../selection/context";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

function renderTable() {
	return render(
		<TimelineProvider initialZoom="weeks">
			<RowSelectionProvider>
				<TimelineTableHeader />
				<TimelineTable />
			</RowSelectionProvider>
		</TimelineProvider>,
	);
}

describe("TimelineTable", () => {
	it("renders one row cell per timeline item row", () => {
		const { container } = renderTable();
		expect(
			container.querySelectorAll("[data-testid='timeline-table-row']").length,
		).toBeGreaterThan(0);
	});

	it("positions each row by its rowIndex (first row at the top padding)", () => {
		const { container } = renderTable();
		const first = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		expect(first?.style.top).toBe("7px");
	});

	it("selects a single row on click", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rows[0]);
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("false");
	});

	it("shift-click selects a contiguous range", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rows[0]);
		await user.keyboard("{Shift>}");
		await user.click(rows[2]);
		await user.keyboard("{/Shift}");
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("true");
		expect(rows[2].getAttribute("data-selected")).toBe("true");
	});

	it("header checkbox selects all rows", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		await user.click(screen.getByTestId("timeline-select-all"));
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		expect(
			[...rows].every((r) => r.getAttribute("data-selected") === "true"),
		).toBe(true);
	});

	it("applies a hover background while the pointer is over a row", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.hover(rows[1]);
		expect(rows[1].className).toContain("bg-muted/50");
		await user.unhover(rows[1]);
		expect(rows[1].className).not.toContain("bg-muted/50");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/layout/timeline-table.test.tsx`
Expected: FAIL — `timeline-select-all` not found / rows have no `data-selected`.

- [ ] **Step 3: Write the implementation**

Replace the contents of `apps/web/src/components/timeline/layout/timeline-table.tsx`:

```tsx
import { Checkbox } from "@orbit/ui/components/checkbox";
import { cn } from "@orbit/shared";
import { useMemo } from "react";
import { useTimelineController } from "../controller/context";
import { layoutItems } from "../controller/layout";
import { useRowSelection } from "../selection/context";
import { useTimelineItems } from "../use-timeline-items";
import { contentHeight, ROW_HEIGHT, ROW_PADDING, rowTop } from "./row-metrics";

/** Ordered visible row ids — the shared order both panes select against. */
function useOrderedIds(): string[] {
	const { today } = useTimelineController();
	const { items } = useTimelineItems();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	return useMemo(() => rows.map((r) => r.item.id), [rows]);
}

/** Column titles + select-all checkbox for the header band. */
export function TimelineTableHeader() {
	const orderedIds = useOrderedIds();
	const { selectedIds, selectAll } = useRowSelection();
	const allSelected =
		orderedIds.length > 0 && orderedIds.every((id) => selectedIds.has(id));

	return (
		<div className="flex h-full items-center gap-2 bg-background-primary px-3 text-xs font-semibold text-muted-foreground">
			<Checkbox
				data-testid="timeline-select-all"
				aria-label="Select all rows"
				checked={allSelected}
				onCheckedChange={() => selectAll(orderedIds)}
			/>
			<span className="flex-1">Name</span>
			<span className="w-24 shrink-0">Assignee</span>
			<span className="w-28 shrink-0">Dates</span>
		</div>
	);
}

/** Left table column: one selectable cell per timeline row, aligned to ItemsLayer rows. */
export default function TimelineTable() {
	const { today } = useTimelineController();
	const { items } = useTimelineItems();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	const orderedIds = useMemo(() => rows.map((r) => r.item.id), [rows]);
	const { isSelected, hoveredId, selectOne, selectTo, toggle, setHovered } =
		useRowSelection();

	return (
		<div
			className="relative w-full"
			style={{ height: contentHeight(rows.length) }}
		>
			{rows.map((row) => {
				const top = rowTop(row.rowIndex);
				const { item } = row;
				const selected = isSelected(item.id);
				return (
					<div
						key={item.id}
						data-testid="timeline-table-row"
						data-selected={selected}
						onClick={(e) =>
							e.shiftKey ? selectTo(item.id, orderedIds) : selectOne(item.id)
						}
						onMouseEnter={() => setHovered(item.id)}
						onMouseLeave={() => setHovered(null)}
						className={cn(
							"absolute inset-x-0 flex cursor-pointer items-center gap-2 px-3 text-xs",
							selected
								? "bg-accent"
								: hoveredId === item.id
									? "bg-muted/50"
									: "",
						)}
						style={{ top, height: ROW_HEIGHT - ROW_PADDING * 2 }}
					>
						<Checkbox
							aria-label={`Select ${item.name}`}
							checked={selected}
							onCheckedChange={() => toggle(item.id)}
							onClick={(e) => e.stopPropagation()}
						/>
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
									"min-w-0 truncate",
									row.isParent
										? "font-semibold text-foreground"
										: "text-foreground",
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

Note: `data-selected={selected}` renders the string `"true"`/`"false"` in the DOM, which the test reads via `getAttribute`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/layout/timeline-table.test.tsx`
Expected: PASS (5 tests).

If the shift-click test is flaky because the click order/anchor differs, confirm the click on `rows[0]` sets the anchor and the shift-click on `rows[2]` ranges 0..2; adjust only the test's row indices to match the rendered order (do not change the component).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/layout/timeline-table.tsx apps/web/src/components/timeline/layout/timeline-table.test.tsx
git commit -m "feat(timeline): selectable table rows with checkboxes, shift-range, hover"
```

---

### Task 4: Timeline row-band + bar interaction + provider wiring

**Files:**
- Modify: `apps/web/src/components/timeline/items-layer.tsx`
- Modify: `apps/web/src/components/timeline/layout/split-layout.tsx`
- Test: `apps/web/src/components/timeline/items-layer.test.tsx` (add a case)

**Interfaces:**
- Consumes: `useRowSelection` from `./selection/context` (items-layer) and `../selection/context` (split-layout); existing `ROW_HEIGHT` from `./layout/row-metrics`; existing `RenderRow` rows from `layoutItems`.
- Produces: row bands in the timeline; selection/hover on bars; `RowSelectionProvider` wrapping the layout; Esc-to-clear.

- [ ] **Step 1: Write the failing test (append a selection case)**

Add this test to `apps/web/src/components/timeline/items-layer.test.tsx` (keep the existing tests; add the imports if missing). It renders the table + items under both providers, clicks a table row, and asserts a band appears in the items layer:

```tsx
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import ItemsLayer from "./items-layer";
import TimelineTable from "./layout/timeline-table";
import { RowSelectionProvider } from "./selection/context";
import { useEffect } from "react";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

describe("ItemsLayer row selection band", () => {
	it("renders a row band after a table row is selected", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<RowSelectionProvider>
					<SizeViewport width={800} />
					<TimelineTable />
					<ItemsLayer />
				</RowSelectionProvider>
			</TimelineProvider>,
		);
		expect(
			container.querySelectorAll("[data-testid='timeline-row-band']").length,
		).toBe(0);
		const firstRow = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		if (!firstRow) throw new Error("no table row");
		await user.click(firstRow);
		expect(
			container.querySelectorAll("[data-testid='timeline-row-band']").length,
		).toBe(1);
	});
});
```

(If `items-layer.test.tsx` already imports some of these symbols, merge rather than duplicate imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/items-layer.test.tsx`
Expected: FAIL — no `timeline-row-band` is rendered.

- [ ] **Step 3: Add the row-band layer + bar interaction to items-layer**

In `apps/web/src/components/timeline/items-layer.tsx`:

(a) Add imports near the other relative imports:

```tsx
import { useRowSelection } from "./selection/context";
import { ROW_HEIGHT } from "./layout/row-metrics";
```

(If `ROW_HEIGHT` is already imported from `./layout/row-metrics`, just add `useRowSelection`.)

(b) Inside the `ItemsLayer` component, after the existing hooks, add:

```tsx
	const { isSelected, hoveredId, selectOne, selectTo, setHovered } =
		useRowSelection();
	const orderedIds = rows.map((r) => r.item.id);
```

(`rows` is the existing `layoutItems(...).rows`. Place this after `rows` is defined.)

(c) As the FIRST children inside the content container (before the parent-container rects and bars — so bands paint behind everything in the row), render the bands:

```tsx
			{/* selection / hover row bands (behind bars) */}
			{rows.map((row) => {
				const selected = isSelected(row.item.id);
				const hovered = hoveredId === row.item.id;
				if (!selected && !hovered) return null;
				return (
					<div
						key={`band-${row.item.id}`}
						data-testid="timeline-row-band"
						className={cn(
							"pointer-events-none absolute inset-x-0",
							selected ? "bg-accent" : "bg-muted/50",
						)}
						style={{ top: row.rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
					/>
				);
			})}
```

(`cn` is already imported in items-layer.)

(d) On the leaf/task bar element (the `<div data-testid="timeline-task-bar">`) and the milestone marker element (`<div data-testid="timeline-milestone">`), add hover + click selection handlers alongside the existing `onPointerDown`:

```tsx
						onMouseEnter={() => setHovered(item.id)}
						onMouseLeave={() => setHovered(null)}
						onClick={(e) =>
							e.shiftKey ? selectTo(item.id, orderedIds) : selectOne(item.id)
						}
```

A drag uses pointer capture + movement, which suppresses the synthetic `click`, so dragging a bar moves/resizes it (unchanged) while a stationary click selects its row.

- [ ] **Step 4: Wire the provider + Esc-to-clear into split-layout**

In `apps/web/src/components/timeline/layout/split-layout.tsx`:

(a) Add the import:

```tsx
import { RowSelectionProvider, useRowSelection } from "../selection/context";
```

(b) In `SplitLayoutInner`, read `clear` and add an Esc handler next to the existing arrow-key effect (reuse the existing `isTypingTarget`):

```tsx
	const { clear } = useRowSelection();
```

and a new effect:

```tsx
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isTypingTarget(e.target)) clear();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [clear]);
```

(c) Wrap `SplitLayoutInner` in the provider in the default export:

```tsx
export default function SplitLayout(props: SplitLayoutProps) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<RowSelectionProvider>
				<SplitLayoutInner {...props} />
			</RowSelectionProvider>
		</TimelineProvider>
	);
}
```

- [ ] **Step 5: Run the items-layer test + full timeline suite + typecheck**

Run: `cd apps/web && pnpm test src/components/timeline/items-layer.test.tsx && pnpm test src/components/timeline && pnpm typecheck`
Expected: the new band test PASSES; all existing timeline tests still PASS (the context's no-op default keeps provider-less renders working); no type errors.

- [ ] **Step 6: Lint/format**

Run: `cd /Users/thinhle/Documents/Development/orbit && npx @biomejs/biome check --write apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/selection apps/web/src/components/timeline/layout/timeline-table.tsx`
Then re-run `cd apps/web && pnpm test src/components/timeline`. Expected: no Biome errors in these files; tests still PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/items-layer.test.tsx
git commit -m "feat(timeline): row-band highlight + bar selection/hover, wire RowSelectionProvider + Esc"
```

---

## Manual verification (after Task 4)

- [ ] `cd apps/web && pnpm dev`, open the timeline route.
- [ ] Click a table row → it highlights, and the matching timeline row-band highlights behind the bars.
- [ ] Shift-click another row → the contiguous range highlights in both panes.
- [ ] Per-row checkbox toggles a single row; the header checkbox selects/clears all.
- [ ] Hover a row (table or bar) → both panes show the hover band; moving away clears it.
- [ ] Press Esc → selection clears (but not while focus is in an input).
- [ ] Dragging a bar still moves/resizes it (selection click does not interfere).
