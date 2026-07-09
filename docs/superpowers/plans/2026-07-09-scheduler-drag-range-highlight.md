# Scheduler Drag Range Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a user drags or resizes a scheduler task bar, show the exact dates it will commit to (a cursor-following tooltip) and tint the header cells the new range spans.

**Architecture:** A new drag-range React context carries the in-progress range from `SchedulerLayoutInner` (which already owns `dragDraft`) up to the shared `TimeUnitsBar`, which tints overlapping bottom-row cells. Separately, the Gantt's existing cursor-following drag tooltip is extracted into a shared `DragTooltip` component and reused by the scheduler, which requires `useBarDrag` to expose the pointer position that it currently keeps in a closure.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + @testing-library/react.

## Global Constraints

- **Never run the full test suite.** It exhausts memory on this machine. Run one file at a time with `cd apps/web && pnpm exec vitest run <path>`.
- **Never use `pnpm test -- --run <path>`.** pnpm swallows the path and Vitest runs all ~51 files — the exact full-suite run that OOMs.
- `range.to` (the ms **offset**) is **exclusive**. `endDate` (the **string**) is **inclusive**. Overlap is plain half-open; there is no off-by-one correction anywhere in this plan.
- Use `cn()` from `@orbit/shared` for conditional class merging.
- Tabs for indentation, matching the existing files.
- Do not change any date math, snapping behavior, or commit path.
- Scope is the scheduler only. Do not wire a provider into the Gantt view.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/components/timeline/drag/overlap.ts` | Pure `overlapsRange`. No React. |
| `apps/web/src/components/timeline/drag/context.tsx` | `DragRangeProvider` + `useDragRange`. |
| `apps/web/src/components/timeline/drag/drag-tooltip.tsx` | Presentational cursor-following tooltip. |
| `apps/web/src/components/timeline/header/label.tsx` | `BottomCell` gains `highlighted`. |
| `apps/web/src/components/timeline/header/time-units-bar.tsx` | Reads context, marks bottom cells. |
| `apps/web/src/components/timeline/bars/items-layer.tsx` | Uses extracted `DragTooltip`. |
| `apps/web/src/components/timeline/scheduler/use-bar-drag.ts` | Exposes `pointer` state. |
| `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx` | Renders `DragTooltip`. |
| `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx` | Provides gated drag range. |

All paths below are relative to the repo root. All commands run from `apps/web` unless noted.

---

### Task 1: Pure overlap predicate

**Files:**
- Create: `apps/web/src/components/timeline/drag/overlap.ts`
- Test: `apps/web/src/components/timeline/drag/overlap.test.ts`

**Interfaces:**
- Consumes: `Unit` and `RelativeTimeRangeOffset` from `../units/types`.
- Produces: `overlapsRange(unit: { from: number; to: number }, range: RelativeTimeRangeOffset | null): boolean`

Both `Unit` and `RelativeTimeRangeOffset` are `{ from: number; to: number }` in ms offsets relative to today (see `apps/web/src/components/timeline/units/types.ts`). Both are half-open: `to` is exclusive. So two spans overlap when each starts strictly before the other ends.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/drag/overlap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ONE_DAY } from "../units/make-units";
import { overlapsRange } from "./overlap";

const day = (n: number) => ({ from: n * ONE_DAY, to: (n + 1) * ONE_DAY });

describe("overlapsRange", () => {
	it("returns false when the range is null", () => {
		expect(overlapsRange(day(0), null)).toBe(false);
	});

	it("returns true when the unit sits inside the range", () => {
		expect(overlapsRange(day(2), { from: 0, to: 5 * ONE_DAY })).toBe(true);
	});

	it("returns true when the unit partially overlaps the range", () => {
		expect(overlapsRange(day(4), { from: 0, to: 5 * ONE_DAY })).toBe(true);
	});

	it("excludes the unit starting exactly at the exclusive end", () => {
		expect(overlapsRange(day(5), { from: 0, to: 5 * ONE_DAY })).toBe(false);
	});

	it("excludes the unit ending exactly at the range start", () => {
		expect(overlapsRange(day(0), { from: ONE_DAY, to: 5 * ONE_DAY })).toBe(
			false,
		);
	});

	it("returns false for a zero-width range", () => {
		expect(overlapsRange(day(0), { from: 0, to: 0 })).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/drag/overlap.test.ts`

Expected: FAIL — cannot resolve `./overlap`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/timeline/drag/overlap.ts`:

```ts
import type { RelativeTimeRangeOffset } from "../units/types";

/**
 * Whether a half-open axis unit `[from, to)` intersects a drag range. Both spans
 * carry an exclusive `to`, so they overlap when each starts strictly before the
 * other ends. A null range (no drag in progress) never overlaps.
 */
export function overlapsRange(
	unit: { from: number; to: number },
	range: RelativeTimeRangeOffset | null,
): boolean {
	if (!range) return false;
	return unit.from < range.to && unit.to > range.from;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/drag/overlap.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/drag/overlap.ts apps/web/src/components/timeline/drag/overlap.test.ts
git commit -m "feat(web): add pure overlapsRange predicate for drag range highlight"
```

---

### Task 2: Drag range context

**Files:**
- Create: `apps/web/src/components/timeline/drag/context.tsx`
- Test: `apps/web/src/components/timeline/drag/context.test.tsx`

**Interfaces:**
- Consumes: `RelativeTimeRangeOffset` from `../units/types`.
- Produces:
  - `useDragRange(): RelativeTimeRangeOffset | null`
  - `DragRangeProvider({ range, children }: { range: RelativeTimeRangeOffset | null; children: ReactNode })`

The provider is a thin value-passing wrapper — it holds no state. Its caller decides when `range` is non-null. Default with no provider is `null`, so `TimeUnitsBar` renders unprovided (Gantt view, existing tests).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/drag/context.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DragRangeProvider, useDragRange } from "./context";

function Probe() {
	const range = useDragRange();
	return <span data-testid="probe">{range ? `${range.from}-${range.to}` : "none"}</span>;
}

describe("useDragRange", () => {
	it("defaults to null with no provider", () => {
		render(<Probe />);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});

	it("exposes the provided range", () => {
		render(
			<DragRangeProvider range={{ from: 10, to: 20 }}>
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("10-20");
	});

	it("exposes null when the provider passes null", () => {
		render(
			<DragRangeProvider range={null}>
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/drag/context.test.tsx`

Expected: FAIL — cannot resolve `./context`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/timeline/drag/context.tsx`:

```tsx
import { createContext, type ReactNode, useContext } from "react";
import type { RelativeTimeRangeOffset } from "../units/types";

/**
 * The range of an in-progress bar drag/resize, shared with the header so it can
 * tint the spanned axis cells. The header band and the lanes body are separate
 * branches of the layout tree, and `TimeUnitsBar` is shared with the Gantt view,
 * so this travels by context rather than props.
 *
 * The provider's caller decides when a drag counts as "in progress" — consumers
 * highlight whenever the range is non-null.
 */
const DragRangeContext = createContext<RelativeTimeRangeOffset | null>(null);

export function DragRangeProvider({
	range,
	children,
}: {
	range: RelativeTimeRangeOffset | null;
	children: ReactNode;
}) {
	return (
		<DragRangeContext.Provider value={range}>
			{children}
		</DragRangeContext.Provider>
	);
}

/** The live drag range, or null when no drag is in progress. */
export function useDragRange(): RelativeTimeRangeOffset | null {
	return useContext(DragRangeContext);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/drag/context.test.tsx`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/drag/context.tsx apps/web/src/components/timeline/drag/context.test.tsx
git commit -m "feat(web): add drag range context"
```

---

### Task 3: Header cells tint on drag

**Files:**
- Modify: `apps/web/src/components/timeline/header/label.tsx` (`BottomCell`)
- Modify: `apps/web/src/components/timeline/header/time-units-bar.tsx`
- Test: `apps/web/src/components/timeline/header/time-units-bar.test.tsx` (append)

**Interfaces:**
- Consumes: `overlapsRange` (Task 1), `useDragRange` / `DragRangeProvider` (Task 2).
- Produces: bottom-row cells carry `data-highlighted="true"` when they overlap the drag range.

`BottomCell` currently takes `{ leftPercent, widthPercent, children, withLeftBorder }`. Add one optional prop. The `data-highlighted` attribute goes on the outer `[data-testid='timeline-header-cell']` element so tests can query cells and read the flag off the same node.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/timeline/header/time-units-bar.test.tsx`. Note the existing file already defines `SizeViewport` and `renderBar` — reuse `SizeViewport`, and add these imports to the top of the file:

```tsx
import { DragRangeProvider } from "../drag/context";
import { ONE_DAY } from "../units/make-units";
```

Then append inside the existing `describe("TimeUnitsBar", ...)` block:

```tsx
	it("does not highlight any bottom cell when no drag is in progress", () => {
		const { container } = renderBar("weeks");
		expect(
			container.querySelectorAll("[data-highlighted='true']").length,
		).toBe(0);
	});

	it("highlights only the bottom cells overlapping the drag range", () => {
		// `today` is offset 0, so this range covers exactly days 0 and 1.
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={800} />
				<DragRangeProvider range={{ from: 0, to: 2 * ONE_DAY }}>
					<TimeUnitsBar />
				</DragRangeProvider>
			</TimelineProvider>,
		);
		const highlighted = container.querySelectorAll("[data-highlighted='true']");
		expect(highlighted.length).toBe(2);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/header/time-units-bar.test.tsx`

Expected: FAIL on the second new test — `expected 0 to be 2`. The first new test passes trivially.

- [ ] **Step 3: Add the `highlighted` prop to `BottomCell`**

In `apps/web/src/components/timeline/header/label.tsx`, replace the whole `BottomCell` function with:

```tsx
export function BottomCell({
	leftPercent,
	widthPercent,
	children,
	withLeftBorder = false,
	highlighted = false,
}: {
	leftPercent: number;
	widthPercent: number;
	children: ReactNode;
	withLeftBorder?: boolean;
	highlighted?: boolean;
}) {
	return (
		<div
			data-testid="timeline-header-cell"
			data-highlighted={highlighted || undefined}
			className={cn(
				"absolute top-0 h-full overflow-hidden",
				highlighted && "bg-primary/10",
			)}
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
		>
			<div
				className={cn(
					"box-border h-full whitespace-nowrap text-center text-xs leading-6 text-muted-foreground",
					withLeftBorder && "border-l border-border",
					highlighted && "font-medium text-foreground",
				)}
			>
				{children}
			</div>
		</div>
	);
}
```

`data-highlighted={highlighted || undefined}` omits the attribute entirely when false, so `[data-highlighted='true']` selects exactly the tinted cells.

- [ ] **Step 4: Wire the context into `TimeUnitsBar`**

In `apps/web/src/components/timeline/header/time-units-bar.tsx`, add these imports alongside the existing ones:

```tsx
import { useDragRange } from "../drag/context";
import { overlapsRange } from "../drag/overlap";
```

Inside `TimeUnitsBar`, add this line next to the other hook calls (below `const weekStart = useWeekStart();`):

```tsx
	const dragRange = useDragRange();
```

Then, in the `bottomRow` map, pass the flag through. Replace the returned `<BottomCell ...>` with:

```tsx
		return (
			<BottomCell
				key={today + unit.from}
				leftPercent={left}
				widthPercent={width}
				withLeftBorder={withLeftBorder}
				highlighted={overlapsRange(unit, dragRange)}
			>
				{label}
			</BottomCell>
		);
```

`unit` here is the loop variable already in scope — it has the `{ from, to }` shape `overlapsRange` expects, in offsets relative to `today`, matching the range's units.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/header/time-units-bar.test.tsx`

Expected: PASS, all tests including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/header/label.tsx apps/web/src/components/timeline/header/time-units-bar.tsx apps/web/src/components/timeline/header/time-units-bar.test.tsx
git commit -m "feat(web): tint header cells spanned by an in-progress drag"
```

---

### Task 4: Extract the shared drag tooltip

**Files:**
- Create: `apps/web/src/components/timeline/drag/drag-tooltip.tsx`
- Modify: `apps/web/src/components/timeline/bars/items-layer.tsx:160-176`
- Test: `apps/web/src/components/timeline/bars/items-layer.test.tsx` (run only — no new tests)

**Interfaces:**
- Produces: `DragTooltip({ x, y, label }: { x: number; y: number; label: string })`

This is a pure refactor. The Gantt already renders this tooltip at `items-layer.tsx:160-176` with `data-testid="timeline-drag-tooltip"`. Move the JSX into a component, unchanged — same testid, same classes, same positioning — so the existing `items-layer` tests keep passing and the scheduler gets an identical-looking tooltip for free.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/timeline/drag/drag-tooltip.tsx`:

```tsx
/**
 * Date label that follows the cursor during a bar drag/resize. Rendered `fixed`
 * in viewport coordinates, so callers pass the raw pointer position and don't
 * need to map it into any scroll container.
 */
export default function DragTooltip({
	x,
	y,
	label,
}: {
	x: number;
	y: number;
	label: string;
}) {
	return (
		<div
			data-testid="timeline-drag-tooltip"
			className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium text-background shadow-md"
			style={{ left: x, top: y - 12 }}
		>
			{label}
		</div>
	);
}
```

- [ ] **Step 2: Use it from `items-layer`**

In `apps/web/src/components/timeline/bars/items-layer.tsx`, add the import alongside the existing ones:

```tsx
import DragTooltip from "../drag/drag-tooltip";
```

Replace the `dragTooltip` block (currently lines 160-176) with:

```tsx
	// Date tooltip that follows the cursor during a drag/resize gesture.
	let dragTooltip: ReactNode = null;
	if (active && pointer) {
		const row = rows.find((r) => r.item.id === active.id);
		if (row) {
			const range = draft[active.id] ?? row.range;
			const tip = gestureTooltip(active.role, range, today);
			dragTooltip = (
				<DragTooltip x={pointer.x} y={pointer.y} label={tip.label} />
			);
		}
	}
```

Leave everything else in the file alone, including wherever `{dragTooltip}` is rendered.

- [ ] **Step 3: Run the Gantt tests to verify no regression**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/bars/items-layer.test.tsx`

Expected: PASS. The extraction is behavior-preserving; any failure means the classes, testid, or positioning drifted.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/timeline/drag/drag-tooltip.tsx apps/web/src/components/timeline/bars/items-layer.tsx
git commit -m "refactor(web): extract shared DragTooltip from items-layer"
```

---

### Task 5: Expose pointer position from `useBarDrag`

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/use-bar-drag.ts`
- Test: `apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts` (append)

**Interfaces:**
- Produces: `useBarDrag(...)` return type gains `pointer: { x: number; y: number } | null`.

`useBarDrag` already tracks `lastPointerX` / `lastPointerY` in a closure but never surfaces them. Mirror `useBarInteraction`, which holds `pointer` in state, sets it on `pointermove`, and nulls it on `pointerup`.

Setting `pointer` **only** in `onMove` (never in `beginDrag`) is what makes `active && pointer` false for a click without movement — this is the gate the tooltip and header tint rely on. Do not set it on pointerdown.

- [ ] **Step 1: Write the failing test**

Append these two tests inside the existing `describe("useBarDrag", ...)` block in `apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts`. The file already defines `pointerDownEvent(clientX: number)` (which hardcodes `clientY: 0`), `ONE_DAY`, and the shared `range` fixture, and already imports `act`, `fireEvent`, `renderHook`, and `vi`. Reuse them — do not redefine them, and do not construct raw `new PointerEvent(...)`; this file drives the window listeners with `fireEvent.pointerMove(window, ...)`.

```ts
	it("exposes no pointer until the pointer actually moves", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));

		act(() => {
			result.current.beginDrag(pointerDownEvent(100), {
				id: "t1",
				role: "move",
				range,
			});
		});
		// `active` is set on pointerdown, but `pointer` waits for real movement.
		expect(result.current.active).toEqual({ id: "t1", role: "move" });
		expect(result.current.pointer).toBeNull();
	});

	it("exposes the pointer position during a drag and clears it on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));

		act(() => {
			result.current.beginDrag(pointerDownEvent(100), {
				id: "t1",
				role: "move",
				range,
			});
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 148, clientY: 60 });
		});
		expect(result.current.pointer).toEqual({ x: 148, y: 60 });

		act(() => {
			fireEvent.pointerUp(window, { clientX: 148, clientY: 60 });
		});
		expect(result.current.pointer).toBeNull();
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/scheduler/use-bar-drag.test.ts`

Expected: FAIL — `result.current.pointer` is `undefined`, not `null`.

- [ ] **Step 3: Add the pointer state**

In `apps/web/src/components/timeline/scheduler/use-bar-drag.ts`:

Add to the return type, next to `active`:

```ts
	/** Latest pointer position (viewport coords) during a gesture, else null. */
	pointer: { x: number; y: number } | null;
```

Add the state declaration next to the existing `const [active, setActive] = useState(...)`:

```ts
	const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
```

In `onMove`, after the existing `setDraft(buildDraft(ev.clientY));`, add:

```ts
			setPointer({ x: ev.clientX, y: ev.clientY });
```

In `onUp`, after the existing `setActive(null);`, add:

```ts
			setPointer(null);
```

Change the final return to:

```ts
	return { draft, active, pointer, beginDrag, wasDragged };
```

Do not set `pointer` inside `beginDrag`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/scheduler/use-bar-drag.test.ts`

Expected: PASS, including the two new tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-bar-drag.ts apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts
git commit -m "feat(web): expose pointer position from useBarDrag"
```

---

### Task 6: Wire the scheduler to the tooltip and the header tint

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (append)

**Interfaces:**
- Consumes: `DragTooltip` (Task 4), `pointer` from `useBarDrag` (Task 5), `DragRangeProvider` (Task 2), `gestureTooltip` + `rangeToDates` from `bars/use-bar-interaction`.
- Produces: nothing downstream.

`gestureTooltip(role, range, today)` returns `{ ms, label }`. Its `GestureRole` parameter is `"move" | "resize-start" | "resize-end"` — structurally identical to the scheduler's `DragRole`. Reuse it; do not write a second formatter. It derives its label via `rangeToDates`, the same helper `onUp` uses to commit, so the label always shows the dates that will actually be saved.

- [ ] **Step 1: Write the failing test**

Append these two tests inside the existing top-level `describe` in `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`. The file already defines `renderScheduler()` and imports `fireEvent`, `render`, `screen`, and `within`. Follow the existing drag idiom exactly: `fireEvent.pointerDown(bar, { clientX, clientY, pointerId: 1 })` then `fireEvent.pointerMove(window, ...)`. Do not construct raw `new PointerEvent(...)` and do not wrap in `act` — `fireEvent` handles it. Bars only render after the seed data resolves, hence the `await`.

`gestureTooltip` joins a move's two dates with an en dash (`–`, U+2013), not a hyphen. The regex below must use the en dash.

```tsx
	it("shows a drag tooltip with the committed dates while dragging a bar", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");
		const bar = screen.getAllByTestId("scheduler-bar")[0] as HTMLElement;

		fireEvent.pointerDown(bar, { clientX: 200, clientY: 50, pointerId: 1 });
		// No movement yet: `active` is set but `pointer` is not, so no tooltip.
		expect(screen.queryByTestId("timeline-drag-tooltip")).toBeNull();

		fireEvent.pointerMove(window, { clientX: 360, clientY: 55 });
		const tip = screen.getByTestId("timeline-drag-tooltip");
		expect(tip.textContent).toMatch(/\w{3} \d+ – \w{3} \d+/);

		fireEvent.pointerUp(window, { clientX: 360, clientY: 55 });
		expect(screen.queryByTestId("timeline-drag-tooltip")).toBeNull();
	});

	it("shows no drag tooltip for a click without movement", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");
		const bar = screen.getAllByTestId("scheduler-bar")[0] as HTMLElement;

		fireEvent.pointerDown(bar, { clientX: 200, clientY: 50, pointerId: 1 });
		fireEvent.pointerUp(window, { clientX: 200, clientY: 50 });
		expect(screen.queryByTestId("timeline-drag-tooltip")).toBeNull();
	});
```

`screen` queries `document.body`, which is what we want here: the tooltip renders `fixed` and is not necessarily inside the render `container`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/scheduler/scheduler-view.test.tsx`

Expected: FAIL — no `timeline-drag-tooltip` node after `pointermove`.

- [ ] **Step 3: Render the tooltip from `scheduler-lanes`**

In `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`, add imports:

```tsx
import { gestureTooltip } from "../bars/use-bar-interaction";
import DragTooltip from "../drag/drag-tooltip";
import type { DragRole } from "./use-bar-drag";
```

(`DragRole` is likely already imported — do not duplicate the import.)

Add two props to the `SchedulerLanes` prop object, next to `dragDraft`:

```tsx
	dragActive: { id: string; role: DragRole } | null;
	dragPointer: { x: number; y: number } | null;
```

Just before the component's `return (`, compute the tooltip:

```tsx
	// Date tooltip that follows the cursor during a drag/resize gesture. Gated on
	// `dragPointer`, which is only set once the pointer actually moves — so a
	// plain click-to-select never flashes it.
	let dragTooltip: ReactNode = null;
	if (dragActive && dragPointer && dragDraft) {
		const tip = gestureTooltip(dragActive.role, dragDraft.range, today);
		dragTooltip = (
			<DragTooltip x={dragPointer.x} y={dragPointer.y} label={tip.label} />
		);
	}
```

Add `type ReactNode` to the existing `react` type import at the top of the file.

Render it as the last child of the outer `[data-testid='scheduler-lanes']` div, immediately after the `{rows.map(...)}` block and before the closing `</div>`:

```tsx
			{dragTooltip}
```

- [ ] **Step 4: Pass the new props and provide the range from `scheduler-layout`**

In `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`, add the import:

```tsx
import { DragRangeProvider } from "../drag/context";
```

Destructure `pointer` and `active` out of `useBarDrag` — the existing call already destructures `draft: dragDraft`, `beginDrag`, `wasDragged`:

```tsx
	const {
		draft: dragDraft,
		active: dragActive,
		pointer: dragPointer,
		beginDrag,
		wasDragged,
	} = useBarDrag({
```

(Leave the `useBarDrag` argument object exactly as it is.)

Compute the gated range just below that call:

```tsx
	// The provider — not the header — owns the gate, so `TimeUnitsBar` only ever
	// sees a range it should highlight and needs no pointer-state knowledge.
	const headerDragRange =
		dragActive && dragPointer && dragDraft ? dragDraft.range : null;
```

Pass the two new props to `<SchedulerLanes>`, alongside the existing `dragDraft={dragDraft}`:

```tsx
									dragActive={dragActive}
									dragPointer={dragPointer}
```

Finally, wrap the split region in the provider. The component's returned JSX starts with:

```tsx
		<div className="relative flex h-full flex-col" data-testid="scheduler-view">
```

Wrap that entire `<div>` — from that opening tag through its matching closing `</div>` — in:

```tsx
		<DragRangeProvider range={headerDragRange}>
			{/* ...existing scheduler-view div... */}
		</DragRangeProvider>
```

The provider must enclose both the header band (which renders `TimeUnitsBar`) and the body, which is why it wraps the outermost div rather than the split region alone.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run src/components/timeline/scheduler/scheduler-view.test.tsx`

Expected: PASS, including both new tests.

- [ ] **Step 6: Verify no regression in the neighbouring suites**

Run each separately — never together:

```bash
cd apps/web && pnpm exec vitest run src/components/timeline/header/time-units-bar.test.tsx
cd apps/web && pnpm exec vitest run src/components/timeline/bars/items-layer.test.tsx
cd apps/web && pnpm exec vitest run src/components/timeline/scheduler/use-lane-create.test.ts
```

Expected: PASS for each.

- [ ] **Step 7: Lint and commit**

```bash
pnpm check
git add apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "feat(web): show drag date tooltip and header tint in scheduler"
```

---

## Manual verification

With `pnpm dev` running, open a project's scheduler view and:

1. Drag a task bar sideways. A dark tooltip follows the cursor showing `Mar 3 – Mar 12`, and the day cells in the header tint under the new span.
2. Release. Tooltip and tint disappear; the bar commits to the dates the tooltip showed.
3. Click a bar without moving. No tooltip flashes; the bar selects as before.
4. Drag the left or right resize handle. The tooltip shows the single moving edge's date, not the span.
5. Zoom to `quarters`. The tooltip still shows exact dates; the header tint is quarter-coarse, as designed.
6. Drag a bar onto another assignee's row. The existing lane drop-target tint and the new header tint both show, and don't visually collide.
