# Scheduler Bar Resizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-edge drag handle to scheduler task bars that adjusts each task's `estimatedTime` (snapped to 30 min, within the clamped height band), with live relayout during the drag.

**Architecture:** A pure `estimateFromDrag(startHeight, dy)` inverts the existing `barHeight` mapping. A vertical pointer-gesture hook `useEstimateResize` produces a live `draft` and commits on release. `SchedulerLayoutInner` injects the draft estimate into the items list before the (pure) `layoutScheduler`, so the whole view reflows live. Commit calls the existing `updateItem(id, { estimatedTime })` — local state only; the backend has no `estimatedTime` column.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react. Web tests run from `apps/web`.

## Global Constraints

- Scheduler-only. Do NOT touch the Gantt `bars/` view, `layout.ts`, or `pack-lanes.ts`.
- Handle applies only to `item.kind === "task"` bars.
- Drag maps height 24–96px ↔ estimatedTime 120–480 min (clamped band). `MIN_BAR_HEIGHT=24`, `MAX_BAR_HEIGHT=96`, `PX_PER_MINUTE=0.2` already exist in `lane-metrics.ts`.
- estimatedTime snaps to 30 min (`ESTIMATE_SNAP_MIN = 30`).
- Persistence is local via `updateItem(id, patch)` — no server round-trip.
- `pointerdown` on the handle calls `stopPropagation` so it never selects the bar.
- Avoid `any`. camelCase values, PascalCase types. Use `cn()` (from `@orbit/shared`) for conditional classes.
- The `@/` alias maps to `apps/web/src`.

---

### Task 1: `estimateFromDrag` mapping

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/lane-metrics.ts`
- Test: `apps/web/src/components/timeline/scheduler/lane-metrics.test.ts` (append to existing)

**Interfaces:**
- Consumes: `MIN_BAR_HEIGHT`, `MAX_BAR_HEIGHT`, `PX_PER_MINUTE` (already exported).
- Produces: `ESTIMATE_SNAP_MIN = 30` (number); `estimateFromDrag(startHeight: number, dy: number): number`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/timeline/scheduler/lane-metrics.test.ts`. Add `estimateFromDrag` and `ESTIMATE_SNAP_MIN` to the existing import from `./lane-metrics`, then add:

```ts
describe("estimateFromDrag", () => {
	// barHeight band is 24..96px → 120..480 min at 0.2 px/min, snapped to 30.
	it("clamps to the floor when dragged up past the minimum", () => {
		// startHeight 24 (min), dy -100 → clamps to 24px → 120 min
		expect(estimateFromDrag(24, -100)).toBe(120);
	});

	it("clamps to the ceiling when dragged down past the maximum", () => {
		// startHeight 96 (max), dy +100 → clamps to 96px → 480 min
		expect(estimateFromDrag(96, 100)).toBe(480);
	});

	it("snaps to the nearest 30 minutes", () => {
		// startHeight 24, dy +38 → 62px → 310 min → snaps to 300
		expect(estimateFromDrag(24, 38)).toBe(300);
	});

	it("starts from a no-estimate bar height (24px)", () => {
		// startHeight 24, dy +36 → 60px → 300 min
		expect(estimateFromDrag(24, 36)).toBe(300);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test lane-metrics`
Expected: FAIL — `estimateFromDrag` / `ESTIMATE_SNAP_MIN` not exported.

- [ ] **Step 3: Implement**

Append to `apps/web/src/components/timeline/scheduler/lane-metrics.ts`:

```ts
/** Snap granularity (minutes) for the scheduler bar resizer. */
export const ESTIMATE_SNAP_MIN = 30;

/**
 * Bottom-edge drag → snapped estimatedTime (minutes). Height is clamped to the
 * visual band [MIN_BAR_HEIGHT, MAX_BAR_HEIGHT], so the result stays in 120..480
 * min, then snaps to the nearest ESTIMATE_SNAP_MIN.
 */
export function estimateFromDrag(startHeight: number, dy: number): number {
	const h = Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, startHeight + dy));
	const raw = h / PX_PER_MINUTE;
	return Math.round(raw / ESTIMATE_SNAP_MIN) * ESTIMATE_SNAP_MIN;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test lane-metrics`
Expected: PASS (existing `barHeight` tests + 4 new `estimateFromDrag` tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/lane-metrics.ts apps/web/src/components/timeline/scheduler/lane-metrics.test.ts
git commit -m "feat(web): add estimateFromDrag mapping for scheduler resizer"
```

---

### Task 2: `useEstimateResize` gesture hook

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/use-estimate-resize.ts`
- Test: `apps/web/src/components/timeline/scheduler/use-estimate-resize.test.ts` (create)

**Interfaces:**
- Consumes: `estimateFromDrag` from `./lane-metrics`.
- Produces:
  - `useEstimateResize(opts: { onCommit: (id: string, estimatedTime: number) => void }): { draft: { id: string; estimatedTime: number } | null; active: string | null; beginResize: (e: ReactPointerEvent, target: { id: string; startHeight: number }) => void }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/scheduler/use-estimate-resize.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEstimateResize } from "./use-estimate-resize";

/** Minimal ReactPointerEvent stand-in for beginResize. */
function pointerDownEvent(clientY: number) {
	const target = {
		setPointerCapture: vi.fn(),
		releasePointerCapture: vi.fn(),
	};
	return {
		clientY,
		pointerId: 1,
		currentTarget: target,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	} as unknown as React.PointerEvent;
}

describe("useEstimateResize", () => {
	it("tracks a draft during the drag and commits the snapped estimate on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useEstimateResize({ onCommit }));

		expect(result.current.draft).toBeNull();

		// Begin on a 24px (min) bar at clientY 100.
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
			});
		});
		expect(result.current.active).toBe("t1");

		// Move down 36px → 60px → 300 min.
		act(() => {
			fireEvent.pointerMove(window, { clientY: 136 });
		});
		expect(result.current.draft).toEqual({ id: "t1", estimatedTime: 300 });

		// Release commits and clears.
		act(() => {
			fireEvent.pointerUp(window, { clientY: 136 });
		});
		expect(onCommit).toHaveBeenCalledWith("t1", 300);
		expect(result.current.draft).toBeNull();
		expect(result.current.active).toBeNull();
	});

	it("ignores a second beginResize while a gesture is active", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useEstimateResize({ onCommit }));
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
			});
		});
		act(() => {
			result.current.beginResize(pointerDownEvent(200), {
				id: "t2",
				startHeight: 96,
			});
		});
		expect(result.current.active).toBe("t1");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test use-estimate-resize`
Expected: FAIL — module `./use-estimate-resize` not found.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/components/timeline/scheduler/use-estimate-resize.ts`:

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { estimateFromDrag } from "./lane-metrics";

export type EstimateDraft = { id: string; estimatedTime: number };

/**
 * Vertical pointer-drag on a scheduler bar's bottom edge. Produces a live
 * `draft` estimatedTime during the gesture and commits the snapped value on
 * release. Mirrors the pointer lifecycle of bars/use-bar-interaction (capture,
 * window listeners, unmount cleanup, single-gesture guard) minus zoom/autoscroll.
 */
export function useEstimateResize(opts: {
	onCommit: (id: string, estimatedTime: number) => void;
}): {
	draft: EstimateDraft | null;
	active: string | null;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number },
	) => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const activeListenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);

	const [draft, setDraft] = useState<EstimateDraft | null>(null);
	const [active, setActive] = useState<string | null>(null);

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

	const beginResize = useCallback(
		(e: ReactPointerEvent, target: { id: string; startHeight: number }) => {
			if (activeListenersRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const startY = e.clientY;
			const target0 = e.currentTarget;
			try {
				target0.setPointerCapture(e.pointerId);
			} catch {}

			const compute = (clientY: number): EstimateDraft => ({
				id: target.id,
				estimatedTime: estimateFromDrag(target.startHeight, clientY - startY),
			});

			setActive(target.id);
			setDraft(compute(startY));

			const onMove = (ev: PointerEvent) => {
				setDraft(compute(ev.clientY));
			};
			const onUp = (ev: PointerEvent) => {
				const { id, estimatedTime } = compute(ev.clientY);
				optsRef.current.onCommit(id, estimatedTime);
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
		[],
	);

	return { draft, active, beginResize };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test use-estimate-resize`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-estimate-resize.ts apps/web/src/components/timeline/scheduler/use-estimate-resize.test.ts
git commit -m "feat(web): add useEstimateResize gesture hook"
```

---

### Task 3: Render the handle + wire live relayout

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (append)

**Interfaces:**
- Consumes: `useEstimateResize` from `./use-estimate-resize`; `updateItem`, `items` from `useTimelineData()`.
- `SchedulerLanes` gains a prop `beginResize: (e: ReactPointerEvent, target: { id: string; startHeight: number }) => void`.

- [ ] **Step 1: Add the `beginResize` prop and handle to `SchedulerLanes`**

In `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`:

Add the React type import at the top (after the existing imports):

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
```

Change the component signature and props type to accept `beginResize`:

```tsx
export default function SchedulerLanes({
	rows,
	totalHeight,
	beginResize,
}: {
	rows: SchedulerRow[];
	totalHeight: number;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number },
	) => void;
}) {
```

Add the `group` class to the bar `<button>` — change its `className` `cn(...)` first argument so the string begins with `group `:

```tsx
									className={cn(
										"group pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm",
										(selected || hovered) && "ring-2 ring-primary",
									)}
```

Inside the `<button>`, immediately after the closing `</span>` of the task name (`<span className="relative truncate">{item.name}</span>`) and before the `</button>`, add the handle:

```tsx
									{item.kind === "task" && (
										<span
											data-testid="scheduler-bar-resize"
											onPointerDown={(e) => {
												e.stopPropagation();
												beginResize(e, { id: item.id, startHeight: height });
											}}
											className="pointer-events-auto absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
										/>
									)}
```

- [ ] **Step 2: Wire the hook and draft injection in `scheduler-layout.tsx`**

In `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`:

Add the import:

```ts
import { useEstimateResize } from "./use-estimate-resize";
```

In `SchedulerLayoutInner`, replace the data-context destructure and layout memo. Currently:

```tsx
	const { items } = useTimelineData();

	const { rows, totalHeight } = useMemo(
		() => layoutScheduler(items, "assignee", today),
		[items, today],
	);
```

with:

```tsx
	const { items, updateItem } = useTimelineData();
	const { draft, beginResize } = useEstimateResize({
		onCommit: (id, estimatedTime) => updateItem(id, { estimatedTime }),
	});

	const effectiveItems = useMemo(
		() =>
			draft
				? items.map((i) =>
						i.id === draft.id ? { ...i, estimatedTime: draft.estimatedTime } : i,
					)
				: items,
		[items, draft],
	);

	const { rows, totalHeight } = useMemo(
		() => layoutScheduler(effectiveItems, "assignee", today),
		[effectiveItems, today],
	);
```

Pass `beginResize` to `SchedulerLanes` — change the render near the bottom:

```tsx
							<SchedulerLanes
								rows={rows}
								totalHeight={totalHeight}
								beginResize={beginResize}
							/>
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors in timeline/scheduler files. (Pre-existing unrelated errors elsewhere, if any, do not block — note them.)

- [ ] **Step 4: Write the failing integration test**

Append to `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`. Add `fireEvent` and `within` to the `@testing-library/react` import, and `beforeEach`/`vi` are not needed. Add this test inside the existing `describe("SchedulerView", ...)` block:

```ts
	it("drag on a bar's resize handle sets its height to the clamped max", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		// Task bars carry a resize handle; milestones do not.
		const handles = screen.getAllByTestId("scheduler-bar-resize");
		expect(handles.length).toBeGreaterThan(0);
		const handle = handles[0];
		const bar = handle.closest(
			"[data-testid='scheduler-bar']",
		) as HTMLElement;

		// Drag far downward: any startHeight + large dy clamps to MAX (96px → 480min).
		fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientY: 400 });
		fireEvent.pointerUp(window, { clientY: 400 });

		expect(bar.style.height).toBe("96px");
	});
```

- [ ] **Step 5: Run the integration test to verify it passes**

Run: `cd apps/web && pnpm test scheduler-view`
Expected: PASS. If it fails because no `scheduler-bar-resize` handles exist, confirm the seed has `kind: "task"` bars visible in the default viewport (they do — the prior feature seeded task estimates). The bar's committed height comes from `updateItem` → local state → relayout, so `style.height` reflects the new `barHeight` (`96px`).

- [ ] **Step 6: Run the full scheduler suite + typecheck**

Run: `cd apps/web && pnpm test scheduler && pnpm typecheck`
Expected: lane-metrics, use-estimate-resize, layout, group-rows, pack-lanes, scheduler-view all PASS; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "feat(web): scheduler bar bottom-resizer for estimatedTime"
```

---

## Self-Review

- **Spec coverage:** mapping/clamp/snap → Task 1; gesture hook (capture, listeners, cleanup, single-gesture guard, draft, commit) → Task 2; scheduler-only + task-only handle, `group` CSS reveal, stopPropagation, live relayout via draft injection, local `updateItem` persistence → Task 3. Tests: unit (Task 1), interaction (Task 2), integration (Task 3). All covered.
- **Type consistency:** `estimateFromDrag(startHeight, dy)`, `EstimateDraft = { id, estimatedTime }`, `useEstimateResize({ onCommit })` returning `{ draft, active, beginResize }`, and `beginResize(e, { id, startHeight })` are used identically across Tasks 2–3.
- **Untouched files honored:** no task modifies `layout.ts`, `pack-lanes.ts`, or the `bars/` view.
- **Placeholder scan:** none — every code step shows full code and exact commands.
