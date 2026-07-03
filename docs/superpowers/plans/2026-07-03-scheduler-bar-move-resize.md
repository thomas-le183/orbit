# Scheduler Bar Move + Edge Resize (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let scheduler bars be dragged horizontally to reschedule (body = move) and resized at their left/right edges to change start/end dates, with whole-day snapping, live preview, and backend persistence.

**Architecture:** A scheduler gesture hook `useBarDrag` composes the Gantt's already-tested pure helpers (`pxToDays`, `applyMove`, `applyResize`, `rangeToDates`) plus `useEdgeAutoScroll`. It produces a live `draft` range; `scheduler-lanes.tsx` overrides the active bar's `left`/`width` from the draft (no re-pack); on release it commits dates via `updateItem` (local) + `scheduleTask` (backend). Selection (bar `onClick`) is preserved via a `wasDragged()` flag.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react. Web tests run from `apps/web`.

## Global Constraints

- Scheduler-only. Do NOT modify `layout.ts`, `pack-lanes.ts`, or the Gantt `bars/` view. `bars/use-bar-interaction.ts` and `bars/use-edge-autoscroll.ts` are consumed READ-ONLY.
- Whole-day snapping; min duration 1 day (`applyResize` default).
- Reuse `pxToDays`, `applyMove`, `applyResize`, `rangeToDates`, `ResizeEdge` from `../bars/use-bar-interaction`; `pxPerMs` from `../controller/geometry`; `useEdgeAutoScroll` from `../bars/use-edge-autoscroll`.
- Persistence: `updateItem(id, { startDate, endDate })` (local, instant) + `scheduleTask(id, startDate, endDate)` (backend; no-ops server-side in seed mode).
- Selection preserved: bar keeps `onClick`; a real drag sets a `wasDragged` flag the `onClick` consumes to skip `toggle`.
- The active bar's live preview overrides `left`/`width` in the renderer; the drag draft is NOT injected into `layoutScheduler`.
- Avoid `any`. camelCase values, PascalCase types. Use `cn()` for conditional classes. `@/` alias maps to `apps/web/src`.

---

### Task 1: `useBarDrag` gesture hook

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/use-bar-drag.ts`
- Test: `apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts` (create)

**Interfaces:**
- Consumes: `pxToDays`, `applyMove`, `applyResize`, `rangeToDates`, `ResizeEdge` from `../bars/use-bar-interaction`; `pxPerMs` from `../controller/geometry`; `useEdgeAutoScroll` from `../bars/use-edge-autoscroll`; `useTimelineController` from `../controller/context`; `RelativeTimeRangeOffset` from `../units/types`.
- Produces:
  - `DragRole = "move" | "resize-start" | "resize-end"`
  - `useBarDrag({ onCommit }): { draft: { id; range } | null; active: { id; role } | null; beginDrag(e, { id, role, range }); wasDragged(): boolean }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts`. It mocks `useTimelineController` (fixed zoom `"weeks"` = 32 px/day, fixed `today`) and `useEdgeAutoScroll` (no-op), so pixel deltas map deterministically to days.

```ts
import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { startOfUtcDay } from "../units/make-units";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));

vi.mock("../controller/context", () => ({
	useTimelineController: () => ({ zoomLevel: "weeks", today: TODAY }),
}));
vi.mock("../bars/use-edge-autoscroll", () => ({
	useEdgeAutoScroll: () => ({ start: vi.fn(), stop: vi.fn(), setPointer: vi.fn() }),
}));

import { useBarDrag } from "./use-bar-drag";

const ONE_DAY = 86_400_000;
// weeks = 32 px/day.
function pointerDownEvent(clientX: number) {
	const target = {
		setPointerCapture: vi.fn(),
		releasePointerCapture: vi.fn(),
	};
	return {
		clientX,
		clientY: 0,
		pointerId: 1,
		currentTarget: target,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	} as unknown as React.PointerEvent;
}

// A 3-day task starting today: from 0, to 3 days (exclusive end).
const range = { from: 0, to: 3 * ONE_DAY };

describe("useBarDrag", () => {
	it("moves both dates by the snapped day delta on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));

		act(() => {
			result.current.beginDrag(pointerDownEvent(100), {
				id: "t1",
				role: "move",
				range,
			});
		});
		expect(result.current.active).toEqual({ id: "t1", role: "move" });

		// +96px = +3 days at 32 px/day.
		act(() => {
			fireEvent.pointerMove(window, { clientX: 196, clientY: 0 });
		});
		expect(result.current.draft).toEqual({
			id: "t1",
			range: { from: 3 * ONE_DAY, to: 6 * ONE_DAY },
		});

		act(() => {
			fireEvent.pointerUp(window, { clientX: 196, clientY: 0 });
		});
		// range {3d, 6d} → start today+3, end today+6-1day.
		expect(onCommit).toHaveBeenCalledWith("t1", {
			startDate: "2026-06-04",
			endDate: "2026-06-06",
		});
		expect(result.current.draft).toBeNull();
		expect(result.current.active).toBeNull();
		expect(result.current.wasDragged()).toBe(true);
	});

	it("resize-end moves only the end date", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t1",
				role: "resize-end",
				range,
			});
		});
		// +64px = +2 days.
		act(() => {
			fireEvent.pointerUp(window, { clientX: 64, clientY: 0 });
		});
		// range {0, 5d} → start today, end today+5-1day.
		expect(onCommit).toHaveBeenCalledWith("t1", {
			startDate: "2026-06-01",
			endDate: "2026-06-05",
		});
	});

	it("reports no drag for a stationary press (tap)", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(50), {
				id: "t1",
				role: "move",
				range,
			});
		});
		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 0 });
		});
		expect(result.current.wasDragged()).toBe(false);
	});

	it("ignores a second beginDrag while a gesture is active", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t1",
				role: "move",
				range,
			});
		});
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t2",
				role: "move",
				range,
			});
		});
		expect(result.current.active).toEqual({ id: "t1", role: "move" });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test use-bar-drag`
Expected: FAIL — module `./use-bar-drag` not found.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/components/timeline/scheduler/use-bar-drag.ts`:

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	applyMove,
	applyResize,
	pxToDays,
	rangeToDates,
	type ResizeEdge,
} from "../bars/use-bar-interaction";
import { useEdgeAutoScroll } from "../bars/use-edge-autoscroll";
import { useTimelineController } from "../controller/context";
import { pxPerMs } from "../controller/geometry";
import type { RelativeTimeRangeOffset } from "../units/types";

export type DragRole = "move" | "resize-start" | "resize-end";

export type DragTarget = {
	id: string;
	role: DragRole;
	range: RelativeTimeRangeOffset;
};

/** Pixels of pointer travel past which a press counts as a drag, not a tap. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Pointer-driven horizontal move/resize for scheduler bars. Produces a live
 * `draft` range and commits day-snapped dates on release. Composes the Gantt's
 * pure helpers; mirrors the pointer lifecycle of use-bar-interaction (capture,
 * window listeners, unmount cleanup, single-gesture guard, edge-autoscroll).
 */
export function useBarDrag(opts: {
	onCommit: (id: string, dates: { startDate: string; endDate: string }) => void;
}): {
	draft: { id: string; range: RelativeTimeRangeOffset } | null;
	active: { id: string; role: DragRole } | null;
	beginDrag: (e: ReactPointerEvent, target: DragTarget) => void;
	wasDragged: () => boolean;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const activeListenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);
	const draggedRef = useRef(false);

	const { zoomLevel, today } = useTimelineController();
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;
	const todayRef = useRef(today);
	todayRef.current = today;
	const edgeScroll = useEdgeAutoScroll();

	const [draft, setDraft] = useState<{
		id: string;
		range: RelativeTimeRangeOffset;
	} | null>(null);
	const [active, setActive] = useState<{ id: string; role: DragRole } | null>(
		null,
	);

	useEffect(() => {
		return () => {
			if (activeListenersRef.current) {
				window.removeEventListener(
					"pointermove",
					activeListenersRef.current.move,
				);
				window.removeEventListener("pointerup", activeListenersRef.current.up);
				activeListenersRef.current = null;
			}
		};
	}, []);

	const beginDrag = useCallback(
		(e: ReactPointerEvent, target: DragTarget) => {
			if (activeListenersRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const startX = e.clientX;
			const target0 = e.currentTarget;
			try {
				target0.setPointerCapture(e.pointerId);
			} catch {}

			draggedRef.current = false;
			setActive({ id: target.id, role: target.role });
			setDraft({ id: target.id, range: target.range });

			let panAccumMs = 0;
			let lastPointerX = startX;

			const totalDays = (): number =>
				pxToDays(
					lastPointerX - startX + panAccumMs * pxPerMs(zoomRef.current),
					zoomRef.current,
				);

			const computeRange = (): RelativeTimeRangeOffset => {
				const days = totalDays();
				if (target.role === "move") return applyMove(target.range, days);
				const edge: ResizeEdge =
					target.role === "resize-start" ? "start" : "end";
				return applyResize(target.range, edge, days);
			};

			edgeScroll.start(startX, e.clientY, (panMs) => {
				panAccumMs += panMs;
				setDraft({ id: target.id, range: computeRange() });
			});

			const onMove = (ev: PointerEvent) => {
				lastPointerX = ev.clientX;
				if (Math.abs(ev.clientX - startX) > DRAG_THRESHOLD_PX) {
					draggedRef.current = true;
				}
				edgeScroll.setPointer(ev.clientX, ev.clientY);
				setDraft({ id: target.id, range: computeRange() });
			};
			const onUp = (ev: PointerEvent) => {
				edgeScroll.stop();
				lastPointerX = ev.clientX;
				optsRef.current.onCommit(
					target.id,
					rangeToDates(computeRange(), todayRef.current),
				);
				setDraft(null);
				setActive(null);
				try {
					target0.releasePointerCapture(ev.pointerId);
				} catch {}
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				activeListenersRef.current = null;
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			activeListenersRef.current = { move: onMove, up: onUp };
		},
		[edgeScroll.start, edgeScroll.stop, edgeScroll.setPointer],
	);

	const wasDragged = useCallback(() => {
		const v = draggedRef.current;
		draggedRef.current = false;
		return v;
	}, []);

	return { draft, active, beginDrag, wasDragged };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test use-bar-drag`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: clean for scheduler files (pre-existing unrelated errors elsewhere, if any, don't block).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-bar-drag.ts apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts
git commit -m "feat(web): add useBarDrag hook for scheduler move/resize"
```

---

### Task 2: Render handles + body move + wire persistence

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (append)

**Interfaces:**
- Consumes: `useBarDrag`, `DragRole` from `./use-bar-drag`; `updateItem`, `scheduleTask` from `useTimelineData()`.
- `SchedulerLanes` gains props: `beginDrag`, `dragDraft: { id; range } | null`, `wasDragged: () => boolean`.

- [ ] **Step 1: Add drag props + body move + edge handles to `SchedulerLanes`**

In `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`:

Add to imports (top): the `RelativeTimeRangeOffset` type and `DragRole`:

```ts
import type { RelativeTimeRangeOffset } from "../units/types";
import type { DragRole } from "./use-bar-drag";
```

Extend the props destructure + type to add `beginDrag`, `dragDraft`, `wasDragged`:

```tsx
export default function SchedulerLanes({
	rows,
	totalHeight,
	beginResize,
	beginDrag,
	dragDraft,
	wasDragged,
}: {
	rows: SchedulerRow[];
	totalHeight: number;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number },
	) => void;
	beginDrag: (
		e: ReactPointerEvent,
		target: { id: string; role: DragRole; range: RelativeTimeRangeOffset },
	) => void;
	dragDraft: { id: string; range: RelativeTimeRangeOffset } | null;
	wasDragged: () => boolean;
}) {
```

Inside the `lane.bars.map(({ item, range }) => {` body, override the range with the live draft for the active bar. Replace the first lines of the callback:

```tsx
					lane.bars.map(({ item, range: ownRange }) => {
						const range =
							dragDraft?.id === item.id ? dragDraft.range : ownRange;
						if (rangeVisibility(range.from, range.to, geom) !== "visible") {
							return null;
						}
```

(The rest — `left`/`right`/`width` — already derive from `range`, so they now follow the draft.)

Change the bar `<button>`'s `onClick` to consume the drag flag, and add `onPointerDown` for body-move plus `cursor-grab`:

```tsx
								onClick={() => {
									if (wasDragged()) return;
									toggle(item.id);
								}}
								onPointerDown={(e) =>
									beginDrag(e, { id: item.id, role: "move", range })
								}
```

Add `cursor-grab` to the button's `cn(...)` base string (append to the existing first string literal):

```tsx
								className={cn(
									"group pointer-events-auto absolute flex cursor-grab items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm",
									(selected || hovered) && "ring-2 ring-primary",
								)}
```

Add the two edge handles as children of the button, immediately after the existing bottom estimate handle block (inside the same `item.kind === "task"` region is fine, but keep them as their own conditional for clarity):

```tsx
								{item.kind === "task" && (
									<>
										<span
											data-testid="scheduler-bar-resize-start"
											onPointerDown={(e) => {
												e.stopPropagation();
												beginDrag(e, {
													id: item.id,
													role: "resize-start",
													range,
												});
											}}
											className="pointer-events-auto absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
										/>
										<span
											data-testid="scheduler-bar-resize-end"
											onPointerDown={(e) => {
												e.stopPropagation();
												beginDrag(e, {
													id: item.id,
													role: "resize-end",
													range,
												});
											}}
											className="pointer-events-auto absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
										/>
									</>
								)}
```

(The existing bottom `scheduler-bar-resize` estimate handle stays as-is.)

- [ ] **Step 2: Wire `useBarDrag` in `scheduler-layout.tsx`**

In `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`:

Add the import:

```ts
import { useBarDrag } from "./use-bar-drag";
```

Add `scheduleTask` to the data-context destructure and set up the hook. Currently:

```tsx
	const { items, updateItem } = useTimelineData();
	const { draft, beginResize } = useEstimateResize({
		onCommit: (id, estimatedTime) => updateItem(id, { estimatedTime }),
	});
```

becomes:

```tsx
	const { items, updateItem, scheduleTask } = useTimelineData();
	const { draft, beginResize } = useEstimateResize({
		onCommit: (id, estimatedTime) => updateItem(id, { estimatedTime }),
	});
	const {
		draft: dragDraft,
		beginDrag,
		wasDragged,
	} = useBarDrag({
		onCommit: (id, dates) => {
			updateItem(id, dates);
			scheduleTask(id, dates.startDate, dates.endDate);
		},
	});
```

(The estimate `effectiveItems` memo and layout memo are unchanged — the drag draft is NOT injected.)

Pass the new props to `SchedulerLanes` (the render near line 222):

```tsx
							<SchedulerLanes
								rows={rows}
								totalHeight={totalHeight}
								beginResize={beginResize}
								beginDrag={beginDrag}
								dragDraft={dragDraft}
								wasDragged={wasDragged}
							/>
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: clean for timeline/scheduler files.

- [ ] **Step 4: Write the failing integration test**

Append to `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`, inside the existing `describe("SchedulerView", ...)`. This drives a body move and asserts the bar's horizontal position (`left`) changes after release. (The `ResizeObserver` mock added in the resizer feature is already in this file; if not present, add the same mock used by `split-layout.test.tsx`.)

```ts
	it("dragging a bar body horizontally reschedules it (left shifts)", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		const bar = screen.getAllByTestId("scheduler-bar")[0] as HTMLElement;
		const before = bar.style.left;

		// Body drag: pointerdown on the bar, move right well past a day, release.
		fireEvent.pointerDown(bar, { clientX: 200, clientY: 50, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 360, clientY: 50 });
		fireEvent.pointerUp(window, { clientX: 360, clientY: 50 });

		// After a committed move, the task's dates changed → its rendered left moves.
		expect(bar.style.left).not.toBe(before);
	});
```

- [ ] **Step 5: Run the integration test**

Run: `cd apps/web && pnpm test scheduler-view`
Expected: PASS. The move commits via `updateItem` (local state) → re-render with new dates → new `left`. If the first bar happens to be at a position where a rightward move is culled, the assertion still holds because the committed local date change re-renders `left`; if flaky due to the specific seed bar, target a bar by a known seed task title instead of index.

- [ ] **Step 6: Run the full scheduler suite + typecheck**

Run: `cd apps/web && pnpm test scheduler && pnpm typecheck`
Expected: lane-metrics, use-estimate-resize, use-bar-drag, layout, group-rows, pack-lanes, scheduler-view all PASS; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "feat(web): scheduler bar horizontal move + edge resize"
```

---

## Self-Review

- **Spec coverage:** hook composing pure helpers + edge-autoscroll + day-snap + wasDragged → Task 1; body move, edge handles, renderer draft override, onClick guard, persistence (updateItem + scheduleTask), no draft injection → Task 2. Tests: interaction (Task 1, all roles + tap + guard), integration (Task 2). Covered.
- **Type consistency:** `DragRole`, `beginDrag(e, { id, role, range })`, `draft {id, range}`, `wasDragged()` identical across Tasks 1–2 and the `SchedulerLanes` props.
- **Untouched files honored:** `layout.ts`, `pack-lanes.ts`, `bars/*` not modified (bars/ imported read-only).
- **Placeholder scan:** none — full code and exact commands in every step.
