# Gantt Draft Row Task Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline "draft row" to the Gantt view that creates a task via name-first quick-add (undated) or drag-to-sketch (dated), both feeding one commit path.

**Architecture:** A `DraftTaskProvider` context holds one pending draft `{ name, startDate?, endDate? }` shared by the two Gantt panes. The draft renders as the **last content row**: a `DraftTableCell` (inline name input) in the table column and a `DraftLane` (drag surface + dashed ghost bar) in the items canvas. A pure `draftRangeFromDrag` helper maps a horizontal pointer drag to inclusive UTC day boundaries. Commit calls the existing `useCreateTask` mutation.

**Tech Stack:** React 19, TypeScript, TanStack Query, `@tanstack/react-virtual`, Tailwind v4, Vitest + Testing Library, Biome.

## Global Constraints

- Package manager is **pnpm**; run web tests from `apps/web` (`cd apps/web && pnpm test`), typecheck from repo root (`pnpm typecheck`), lint/format via `pnpm check`.
- **TDD**: write the failing test first, watch it fail, implement minimal code, watch it pass, commit.
- Dates are **UTC date-only** strings (`YYYY-MM-DD`) produced by `toUtcDateString` / `startOfUtcDay` from `../units/make-units`. Never convert draft dates through a local timezone.
- `CreateTaskInput` requires `name` (1–500 chars); `startDate`/`endDate` are optional `YYYY-MM-DD`. Commit payload shape must match the existing `CreateTaskDialog`: `{ name, ...(startDate?), ...(endDate?) }`.
- New code lives under `apps/web/src/components/timeline/draft/`. Follow existing timeline conventions (`cn()` for classes, colocated `*.test.ts(x)`, `data-testid` hooks).
- Non-goals: touching the scheduler view, removing the `CreateTaskDialog` modal, assignee/parent selection in the draft row.

---

### Task 1: `draftRangeFromDrag` pure helper

Maps two client-X pointer positions across the canvas lane to inclusive UTC day boundaries. A near-zero drag (a click) seeds a default 7-day span at the clicked day.

**Files:**
- Create: `apps/web/src/components/timeline/draft/draft-range.ts`
- Test: `apps/web/src/components/timeline/draft/draft-range.test.ts`

**Interfaces:**
- Consumes: `Geometry`, `percentToMs` from `../controller/geometry`; `ONE_DAY`, `startOfUtcDay`, `toUtcDateString` from `../units/make-units`.
- Produces:
  - `DEFAULT_DRAFT_SPAN_DAYS = 7`
  - `CLICK_THRESHOLD_PX = 4`
  - `draftRangeFromDrag(startClientX: number, currentClientX: number, laneRect: Pick<DOMRect, "left" | "width">, geom: Geometry, today: number): { startDate: string; endDate: string }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/components/timeline/draft/draft-range.test.ts
import { describe, expect, it } from "vitest";
import type { Geometry } from "../controller/geometry";
import { draftRangeFromDrag } from "./draft-range";

// viewportWidth 480 @ weeks (48px/day) → each 48px lane pixel === 1 calendar day.
const geom: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 480 };
const today = Date.UTC(2026, 6, 1); // 2026-07-01 UTC midnight
const rect = { left: 0, width: 480 };

describe("draftRangeFromDrag", () => {
	it("maps a forward drag to an inclusive UTC day range", () => {
		expect(draftRangeFromDrag(0, 48 * 4, rect, geom, today)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-05",
		});
	});

	it("normalizes a backward drag so start <= end", () => {
		expect(draftRangeFromDrag(48 * 4, 0, rect, geom, today)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-05",
		});
	});

	it("treats a sub-threshold drag as a click and seeds a 7-day span", () => {
		// clientX 100 → day 2026-07-03; +6 days inclusive → 2026-07-09.
		expect(draftRangeFromDrag(100, 101, rect, geom, today)).toEqual({
			startDate: "2026-07-03",
			endDate: "2026-07-09",
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- draft-range`
Expected: FAIL — `draftRangeFromDrag` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/components/timeline/draft/draft-range.ts
import { type Geometry, percentToMs } from "../controller/geometry";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";

/** Default span (inclusive days) when a draft is created by a click, not a drag. */
export const DEFAULT_DRAFT_SPAN_DAYS = 7;
/** Horizontal travel (px) below which a drag counts as a click. */
export const CLICK_THRESHOLD_PX = 4;

/**
 * Map a horizontal pointer drag across the draft lane to an inclusive UTC day
 * range. A near-zero drag (a click) seeds a default span anchored at the day
 * under the cursor. Mirrors items-layer's startTsFromClientX conversion.
 */
export function draftRangeFromDrag(
	startClientX: number,
	currentClientX: number,
	laneRect: Pick<DOMRect, "left" | "width">,
	geom: Geometry,
	today: number,
): { startDate: string; endDate: string } {
	const dayAt = (clientX: number): number => {
		const percent =
			laneRect.width <= 0
				? 0
				: ((clientX - laneRect.left) / laneRect.width) * 100;
		return startOfUtcDay(today + percentToMs(percent, geom));
	};

	if (Math.abs(currentClientX - startClientX) < CLICK_THRESHOLD_PX) {
		const start = dayAt(startClientX);
		return {
			startDate: toUtcDateString(start),
			endDate: toUtcDateString(start + (DEFAULT_DRAFT_SPAN_DAYS - 1) * ONE_DAY),
		};
	}

	const a = dayAt(startClientX);
	const b = dayAt(currentClientX);
	return {
		startDate: toUtcDateString(Math.min(a, b)),
		endDate: toUtcDateString(Math.max(a, b)),
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- draft-range`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/draft/draft-range.ts apps/web/src/components/timeline/draft/draft-range.test.ts
git commit -m "feat(web): add draftRangeFromDrag helper for Gantt draft row"
```

---

### Task 2: `DraftTaskProvider` + `useDraftTask` state

Holds the shared pending draft and the commit path. Outside a provider it returns a disabled no-op value so existing pane tests keep passing.

**Files:**
- Create: `apps/web/src/components/timeline/draft/use-draft-task.tsx`
- Test: `apps/web/src/components/timeline/draft/use-draft-task.test.tsx`

**Interfaces:**
- Consumes: `useCreateTask` from `@/hooks/use-tasks`.
- Produces:
  - `DraftTaskProvider({ projectId, enabled, children }: { projectId: string; enabled: boolean; children: ReactNode })`
  - `useDraftTask(): DraftTaskValue` where
    ```ts
    type DraftTaskValue = {
      enabled: boolean;
      name: string;
      startDate?: string;
      endDate?: string;
      dragging: boolean;
      isPending: boolean;
      inputRef: RefObject<HTMLInputElement | null>;
      setName: (v: string) => void;
      setDates: (startDate: string, endDate: string) => void;
      setDragging: (v: boolean) => void;
      focusInput: () => void;
      commit: () => void;
      cancel: () => void;
    };
    ```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/timeline/draft/use-draft-task.test.tsx
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftTaskProvider, useDraftTask } from "./use-draft-task";

const mutate = vi.fn();
vi.mock("@/hooks/use-tasks", () => ({
	useCreateTask: () => ({ mutate, isPending: false }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
	<DraftTaskProvider projectId="p1" enabled>
		{children}
	</DraftTaskProvider>
);

describe("useDraftTask", () => {
	beforeEach(() => mutate.mockReset());

	it("commits a name-only draft as an undated payload", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => result.current.setName("Beta"));
		act(() => result.current.commit());
		expect(mutate).toHaveBeenCalledWith({ name: "Beta" }, expect.any(Object));
	});

	it("commits a dragged draft with its dates", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => {
			result.current.setName("Gamma");
			result.current.setDates("2026-07-01", "2026-07-05");
		});
		act(() => result.current.commit());
		expect(mutate).toHaveBeenCalledWith(
			{ name: "Gamma", startDate: "2026-07-01", endDate: "2026-07-05" },
			expect.any(Object),
		);
	});

	it("does not commit an empty name", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => result.current.setName("   "));
		act(() => result.current.commit());
		expect(mutate).not.toHaveBeenCalled();
	});

	it("cancel clears name and dates", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => {
			result.current.setName("Delta");
			result.current.setDates("2026-07-01", "2026-07-05");
		});
		act(() => result.current.cancel());
		expect(result.current.name).toBe("");
		expect(result.current.startDate).toBeUndefined();
		expect(result.current.endDate).toBeUndefined();
	});

	it("resets on successful commit", () => {
		mutate.mockImplementation((_input, opts) => opts?.onSuccess?.());
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => result.current.setName("Epsilon"));
		act(() => result.current.commit());
		expect(result.current.name).toBe("");
	});

	it("is disabled with no-op commit outside a provider", () => {
		const { result } = renderHook(() => useDraftTask());
		expect(result.current.enabled).toBe(false);
		act(() => result.current.commit());
		expect(mutate).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- use-draft-task`
Expected: FAIL — module not found / `DraftTaskProvider` undefined.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/timeline/draft/use-draft-task.tsx
import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { useCreateTask } from "@/hooks/use-tasks";

type DraftTaskValue = {
	enabled: boolean;
	name: string;
	startDate?: string;
	endDate?: string;
	dragging: boolean;
	isPending: boolean;
	inputRef: RefObject<HTMLInputElement | null>;
	setName: (v: string) => void;
	setDates: (startDate: string, endDate: string) => void;
	setDragging: (v: boolean) => void;
	focusInput: () => void;
	commit: () => void;
	cancel: () => void;
};

const noop = () => {};

/** Disabled fallback so panes rendered outside the provider render no draft row. */
const DISABLED: DraftTaskValue = {
	enabled: false,
	name: "",
	startDate: undefined,
	endDate: undefined,
	dragging: false,
	isPending: false,
	inputRef: { current: null },
	setName: noop,
	setDates: noop,
	setDragging: noop,
	focusInput: noop,
	commit: noop,
	cancel: noop,
};

const Ctx = createContext<DraftTaskValue>(DISABLED);

export function useDraftTask(): DraftTaskValue {
	return useContext(Ctx);
}

export function DraftTaskProvider({
	projectId,
	enabled,
	children,
}: {
	projectId: string;
	enabled: boolean;
	children: ReactNode;
}) {
	const create = useCreateTask(projectId);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [name, setName] = useState("");
	const [range, setRange] = useState<{ startDate?: string; endDate?: string }>(
		{},
	);
	const [dragging, setDragging] = useState(false);

	const setDates = useCallback((startDate: string, endDate: string) => {
		setRange({ startDate, endDate });
	}, []);

	const reset = useCallback(() => {
		setName("");
		setRange({});
		setDragging(false);
	}, []);

	const cancel = useCallback(() => reset(), [reset]);
	const focusInput = useCallback(() => inputRef.current?.focus(), []);

	const commit = useCallback(() => {
		const trimmed = name.trim();
		if (!trimmed || create.isPending) return;
		create.mutate(
			{
				name: trimmed,
				...(range.startDate ? { startDate: range.startDate } : {}),
				...(range.endDate ? { endDate: range.endDate } : {}),
			},
			{
				onSuccess: () => {
					reset();
					inputRef.current?.focus();
				},
			},
		);
	}, [name, range, create, reset]);

	const value = useMemo<DraftTaskValue>(
		() => ({
			enabled,
			name,
			startDate: range.startDate,
			endDate: range.endDate,
			dragging,
			isPending: create.isPending,
			inputRef,
			setName,
			setDates,
			setDragging,
			focusInput,
			commit,
			cancel,
		}),
		[
			enabled,
			name,
			range.startDate,
			range.endDate,
			dragging,
			create.isPending,
			setDates,
			focusInput,
			commit,
			cancel,
		],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- use-draft-task`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/draft/use-draft-task.tsx apps/web/src/components/timeline/draft/use-draft-task.test.tsx
git commit -m "feat(web): add DraftTaskProvider state for Gantt draft row"
```

---

### Task 3: `DraftRow` presentational halves

`DraftTableCell` (inline input in the table column) and `DraftLane` (drag surface + dashed ghost in the items canvas). Both position at a given `rowIndex`.

**Files:**
- Create: `apps/web/src/components/timeline/draft/draft-row.tsx`
- Test: `apps/web/src/components/timeline/draft/draft-row.test.tsx`

**Interfaces:**
- Consumes: `useDraftTask` (Task 2); `draftRangeFromDrag` (Task 1); `useTimelineController` from `../controller/context`; `useHorizontalPercentageOffset` from `../controller/hooks`; `ROW_HEIGHT`, `ROW_PADDING` from `../layout/row-metrics`; `ONE_DAY`, `startOfUtcDay` from `../units/make-units`; `Input` from `@orbit/ui/components/input`; `PlusIcon` from `lucide-react`.
- Produces:
  - `DraftTableCell({ rowIndex }: { rowIndex: number })`
  - `DraftLane({ rowIndex }: { rowIndex: number })`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/timeline/draft/draft-row.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineProvider } from "../controller/context";
import { DraftLane, DraftTableCell } from "./draft-row";
import { DraftTaskProvider, useDraftTask } from "./use-draft-task";

const mutate = vi.fn();
vi.mock("@/hooks/use-tasks", () => ({
	useCreateTask: () => ({ mutate, isPending: false }),
}));

const withProvider = (children: ReactNode) => (
	<TimelineProvider weekStart={1}>
		<DraftTaskProvider projectId="p1" enabled>
			{children}
		</DraftTaskProvider>
	</TimelineProvider>
);

function SeedDates() {
	const { setDates } = useDraftTask();
	useEffect(() => setDates("2026-07-01", "2026-07-05"), [setDates]);
	return null;
}

describe("DraftRow", () => {
	beforeEach(() => mutate.mockReset());

	it("commits a name on Enter", () => {
		render(withProvider(<DraftTableCell rowIndex={0} />));
		const input = screen.getByLabelText(/new task name/i);
		fireEvent.change(input, { target: { value: "Beta" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(mutate).toHaveBeenCalledWith({ name: "Beta" }, expect.any(Object));
	});

	it("clears the name on Escape", () => {
		render(withProvider(<DraftTableCell rowIndex={0} />));
		const input = screen.getByLabelText(/new task name/i) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "Beta" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input.value).toBe("");
	});

	it("shows the sketched date range in the Dates column", () => {
		render(
			withProvider(
				<>
					<SeedDates />
					<DraftTableCell rowIndex={0} />
				</>,
			),
		);
		expect(screen.getByText(/2026-07-01 → 2026-07-05/)).toBeInTheDocument();
	});

	it("renders the ghost bar in the lane when dates are set", () => {
		render(
			withProvider(
				<>
					<SeedDates />
					<DraftLane rowIndex={0} />
				</>,
			),
		);
		expect(screen.getByTestId("timeline-draft-preview")).toBeInTheDocument();
	});

	it("renders no ghost bar when no dates are set", () => {
		render(withProvider(<DraftLane rowIndex={0} />));
		expect(screen.queryByTestId("timeline-draft-preview")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- draft-row`
Expected: FAIL — `draft-row` module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/timeline/draft/draft-row.tsx
import { cn } from "@orbit/shared";
import { Input } from "@orbit/ui/components/input";
import { PlusIcon } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
} from "react";
import { useTimelineController } from "../controller/context";
import type { Geometry } from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { ROW_HEIGHT, ROW_PADDING } from "../layout/row-metrics";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import { draftRangeFromDrag } from "./draft-range";
import { useDraftTask } from "./use-draft-task";

/** Inline name input + date readout, aligned to a TimelineTable row. */
export function DraftTableCell({ rowIndex }: { rowIndex: number }) {
	const { inputRef, name, startDate, endDate, isPending, setName, commit, cancel } =
		useDraftTask();
	const top = rowIndex * ROW_HEIGHT;
	return (
		<div
			data-testid="timeline-draft-row"
			className="absolute inset-x-0 flex items-center gap-2 px-3 text-xs"
			style={{ top, height: ROW_HEIGHT }}
		>
			<PlusIcon className="size-4 shrink-0 text-muted-foreground" />
			<span className="flex min-w-0 flex-1 items-center gap-1.5">
				{/* Warning slot spacer — keeps the name aligned with warned rows. */}
				<span className="size-3.5 shrink-0" aria-hidden />
				<Input
					ref={inputRef}
					aria-label="New task name"
					placeholder="Add task…"
					value={name}
					disabled={isPending}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commit();
						} else if (e.key === "Escape") {
							e.preventDefault();
							cancel();
						}
					}}
					className="h-6 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
				/>
			</span>
			<span className="w-24 shrink-0" />
			<span className="w-28 shrink-0 truncate text-muted-foreground">
				{startDate && endDate ? `${startDate} → ${endDate}` : "No dates"}
			</span>
		</div>
	);
}

/** Drag surface that sketches a date range and renders a dashed ghost bar. */
export function DraftLane({ rowIndex }: { rowIndex: number }) {
	const { today, offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { startDate, endDate, setDates, setDragging, focusInput } =
		useDraftTask();

	const listenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);

	useEffect(() => {
		return () => {
			if (listenersRef.current) {
				window.removeEventListener("pointermove", listenersRef.current.move);
				window.removeEventListener("pointerup", listenersRef.current.up);
				listenersRef.current = null;
			}
		};
	}, []);

	const top = rowIndex * ROW_HEIGHT;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };

	const beginDrag = (e: ReactPointerEvent) => {
		if (listenersRef.current) return;
		e.preventDefault();
		const rect = e.currentTarget.getBoundingClientRect();
		const startX = e.clientX;
		setDragging(true);
		const apply = (clientX: number) => {
			const r = draftRangeFromDrag(startX, clientX, rect, geom, today);
			setDates(r.startDate, r.endDate);
		};
		apply(startX);
		const onMove = (ev: PointerEvent) => apply(ev.clientX);
		const onUp = (ev: PointerEvent) => {
			apply(ev.clientX);
			setDragging(false);
			focusInput();
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			listenersRef.current = null;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		listenersRef.current = { move: onMove, up: onUp };
	};

	// biome-ignore lint/a11y/useKeyWithClickEvents: pointer-drag surface, keyboard create is the input.
	let ghost: React.ReactNode = null;
	if (startDate && endDate) {
		const left = getPercentageOffset(startOfUtcDay(Date.parse(startDate)) - today);
		const right = getPercentageOffset(
			startOfUtcDay(Date.parse(endDate)) - today + ONE_DAY,
		);
		if (Number.isFinite(left) && Number.isFinite(right)) {
			ghost = (
				<span
					data-testid="timeline-draft-preview"
					className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/60 bg-primary/15"
					style={{
						left: `${left}%`,
						width: `${Math.max(right - left, 0)}%`,
						top: ROW_PADDING,
						height: ROW_HEIGHT - ROW_PADDING * 2,
					}}
				/>
			);
		} else {
			ghost = <span data-testid="timeline-draft-preview" className="hidden" />;
		}
	}

	return (
		<div
			data-testid="timeline-draft-lane"
			onPointerDown={beginDrag}
			className={cn(
				"pointer-events-auto absolute inset-x-0 cursor-crosshair",
			)}
			style={{ top, height: ROW_HEIGHT }}
		>
			{ghost}
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- draft-row`
Expected: PASS (5 tests). If Biome flags the unused `biome-ignore`, remove that stray comment line — it is only needed if lint complains about the click-less drag surface.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/draft/draft-row.tsx apps/web/src/components/timeline/draft/draft-row.test.tsx
git commit -m "feat(web): add DraftRow input + drag-sketch lane for Gantt"
```

---

### Task 4: Wire the draft row into the Gantt panes

Add the draft row as the last content row across both panes and provide the draft state from the split layout. All three consumers must agree on the extra row so the two panes' scroll heights stay in lockstep.

**Files:**
- Modify: `apps/web/src/components/timeline/layout/split-layout.tsx` (add `projectId` prop, `DraftTaskProvider`, extend `rowCount`)
- Modify: `apps/web/src/components/timeline/layout/timeline-table.tsx` (render `DraftTableCell`, extend `totalRows`)
- Modify: `apps/web/src/components/timeline/bars/items-layer.tsx` (render `DraftLane`, extend content height)
- Modify: `apps/web/src/components/timeline/timeline-view.tsx` (pass `projectId` to `SplitLayout`)

**Interfaces:**
- Consumes: `DraftTaskProvider`, `useDraftTask` (Task 2); `DraftTableCell`, `DraftLane` (Task 3).
- Produces: no new exported symbols — a Gantt view that renders the draft row when `projectId` is set and the table is not collapsed.

- [ ] **Step 1: Add the `projectId` prop and provider to `split-layout.tsx`**

In `apps/web/src/components/timeline/layout/split-layout.tsx`:

Add the import near the other layout imports:

```tsx
import { DraftTaskProvider } from "../draft/use-draft-task";
```

Add `projectId` to `SplitLayoutProps`:

```tsx
type SplitLayoutProps = {
	tableHeader: ReactNode;
	table: ReactNode;
	initialTableWidth?: number;
	onNewTask?: () => void;
	/** Enables the inline draft row when set (and the table is not collapsed). */
	projectId?: string;
	/** Layout switcher control, surfaced inside the toolbar's Customize menu. */
	viewSwitch?: ReactNode;
};
```

Destructure `projectId` in `SplitLayoutInner`'s props and compute the enabled flag + row count just after `rowCount` is defined:

```tsx
	// Total stacked rows both panes render, driving the shared virtualizer.
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	const draftEnabled = !!projectId && !collapsed;
	const rowCount =
		rows.length + undatedTaskRows.length + (draftEnabled ? 1 : 0);
```

Wrap the returned root element with the provider. Change the outer return from `<div className="relative flex h-full flex-col">…</div>` to:

```tsx
	return (
		<DraftTaskProvider projectId={projectId ?? ""} enabled={draftEnabled}>
			<div className="relative flex h-full flex-col">
				{/* …existing toolbar + split region unchanged… */}
			</div>
		</DraftTaskProvider>
	);
```

Ensure `SplitLayoutInner` reads `projectId` from props (add it to the destructured parameter list) and that the default export forwards all props (`<SplitLayoutInner {...props} />` already does).

- [ ] **Step 2: Render `DraftTableCell` in `timeline-table.tsx`**

In `apps/web/src/components/timeline/layout/timeline-table.tsx`, add imports:

```tsx
import { DraftTableCell } from "../draft/draft-row";
import { useDraftTask } from "../draft/use-draft-task";
```

In `TimelineTable`, read the enabled flag and extend the row count:

```tsx
	const { isVisible } = useVirtualRows();
	const { enabled: draftEnabled } = useDraftTask();

	const draftIndex = rows.length + undatedTaskRows.length;
	const totalRows = draftIndex + (draftEnabled ? 1 : 0);
```

After the `undatedTaskRows.map(…)` block and before the closing `</div>`, render the draft cell:

```tsx
			{draftEnabled && isVisible(draftIndex) && (
				<DraftTableCell rowIndex={draftIndex} />
			)}
```

- [ ] **Step 3: Render `DraftLane` in `items-layer.tsx`**

In `apps/web/src/components/timeline/bars/items-layer.tsx`, add imports:

```tsx
import { DraftLane } from "../draft/draft-row";
import { useDraftTask } from "../draft/use-draft-task";
```

Read the flag near the other hook reads (after `useVirtualRows()`):

```tsx
	const { enabled: draftEnabled } = useDraftTask();
	const draftIndex = rows.length + undatedTaskRows.length;
```

Update the content-height style on the outer `timeline-items-content` div:

```tsx
			style={{
				height: contentHeight(
					rows.length + undatedTaskRows.length + (draftEnabled ? 1 : 0),
				),
			}}
```

Just before `<DependencyLayer …/>`, render the lane:

```tsx
			{draftEnabled && isVisible(draftIndex) && (
				<DraftLane rowIndex={draftIndex} />
			)}
```

- [ ] **Step 4: Pass `projectId` from `timeline-view.tsx`**

In `apps/web/src/components/timeline/timeline-view.tsx`, add the prop to the `SplitLayout` element:

```tsx
						<SplitLayout
							tableHeader={<TimelineTableHeader />}
							table={<TimelineTable />}
							onNewTask={projectId ? () => setNewTaskOpen(true) : undefined}
							projectId={projectId}
							viewSwitch={viewSwitch}
						/>
```

- [ ] **Step 5: Verify existing pane tests still pass**

Run: `cd apps/web && pnpm test -- items-layer timeline-table`
Expected: PASS — the disabled `useDraftTask` fallback means panes rendered without the provider add no draft row, so existing snapshots/queries are unchanged.

- [ ] **Step 6: Typecheck and full web test suite**

Run: `pnpm typecheck && cd apps/web && pnpm test`
Expected: PASS — no type errors; all timeline tests green.

- [ ] **Step 7: Manual verification**

Start the app (`pnpm dev`), open a project's Gantt view, and confirm:
1. A "+ Add task…" row appears as the last row of the table with a "No dates" readout.
2. Typing a name and pressing Enter creates a task; it appears as an "Unplanned" row and the input clears and stays focused (toast: "Task created").
3. Dragging left→right on the draft lane draws a dashed ghost bar, the Dates column updates, and the input focuses; typing a name + Enter creates a dated task that renders as a bar at those dates.
4. A single click on the draft lane seeds a ~1-week ghost span.
5. Collapsing the table (Customize menu) hides the draft row; the toolbar "New task" modal still works.
6. Pressing Escape in the input clears the pending name and dates.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/layout/timeline-table.tsx apps/web/src/components/timeline/bars/items-layer.tsx apps/web/src/components/timeline/timeline-view.tsx
git commit -m "feat(web): wire draft row into Gantt panes for inline task creation"
```

---

## Self-Review Notes

- **Spec coverage:** name-first quick-add (Task 2 commit + Task 3 input), drag-to-sketch (Task 1 helper + Task 3 lane), last-content-row placement (Task 4), undated-on-name-only via existing Unplanned rows (Task 2 payload omits dates), gating on projectId + collapsed (Task 4 `draftEnabled`), edge cases — empty name blocked (Task 2), Escape clears (Task 2/3), click default span (Task 1), in-flight disable (Task 2 `isPending` + Task 3 input `disabled`), success reset+refocus (Task 2). Modal untouched (Task 4 leaves `CreateTaskDialog`). All covered.
- **Type consistency:** `draftRangeFromDrag` signature, `DraftTaskValue` fields, and `DraftTableCell`/`DraftLane` props are used identically across tasks.
- **No placeholders:** every code step contains complete code.
