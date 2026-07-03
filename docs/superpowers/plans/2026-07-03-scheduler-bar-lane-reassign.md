# Scheduler Bar Lane Reassign (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scheduler bar body-drag 2D: dragging a bar also moves it vertically between assignee lanes, reassigning the task (with the bar following the cursor and the target lane highlighted), committing dates + assignee together on release.

**Architecture:** Extend the existing `useBarDrag` (Slice 1) move gesture to also track pointer Y via an optional `resolveLaneAt(clientY)` callback; the draft gains a target lane key + pointer content-Y. `scheduler-lanes.tsx` renders the dragged bar at the cursor and highlights the target lane. `scheduler-layout.tsx` supplies `resolveLaneAt` (from row geometry) and, on commit, reassigns via a new `reassignTask` data-context method. Non-breaking to Slice 1 (all new hook params are optional).

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react. Web tests run from `apps/web`.

## Global Constraints

- Scheduler-only. Do NOT modify `layout.ts`, `pack-lanes.ts`, or the Gantt `bars/` view. Extend `use-bar-drag.ts` (do not fork it).
- One 2D drag: `move` role tracks X (dates) and Y (lane); resize roles are unaffected (no Y tracking).
- Drop feedback: dragged bar follows the cursor vertically; target lane row highlighted. "Unassigned" row is a valid target.
- Reassign persistence: `updateItem(id, { assignee })` (local) + backend `reassignTask(id, assigneeId)` only when `projectId` present AND the target has a real assignee.
- **Unassign limitation:** dropping on "Unassigned" clears the assignee locally only — `updateTaskSchema.assigneeId` is `z.string().uuid().optional()` (no `null`), so an unassign cannot persist to the backend. Local-only; documented follow-up.
- Backward compatible: all new `useBarDrag` params (`resolveLaneAt`, `target.laneKey`, draft `targetLaneKey`/`pointerContentY`, `onCommit`'s 3rd arg) are optional/additive so Slice 1 behavior is unchanged when `resolveLaneAt` is absent.
- Avoid `any`. camelCase values, PascalCase types. Use `cn()` for conditional classes. `@/` alias maps to `apps/web/src`.

---

### Task 1: Extend `useBarDrag` with vertical lane tracking

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/use-bar-drag.ts`
- Test: `apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts` (append)

**Interfaces:**
- Produces (additive):
  - `opts.resolveLaneAt?: (clientY: number) => { key: string | null; contentY: number }`
  - `opts.onCommit` signature becomes `(id: string, dates: { startDate: string; endDate: string }, targetLaneKey: string | null) => void`
  - `DragTarget` gains optional `laneKey?: string` (the bar's current lane)
  - `draft` gains optional `targetLaneKey?: string | null` and `pointerContentY?: number`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts` a describe block. It provides a `resolveLaneAt` stub that maps clientY to a lane key.

```ts
describe("useBarDrag vertical lane tracking", () => {
	// clientY < 100 → lane "a" (contentY passthrough); >= 100 → lane "b".
	const resolveLaneAt = (clientY: number) => ({
		key: clientY < 100 ? "a" : "b",
		contentY: clientY,
	});

	it("tracks the target lane + pointer position during a move and commits the lane on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() =>
			useBarDrag({ onCommit, resolveLaneAt }),
		);

		act(() => {
			result.current.beginDrag(pointerDownEvent(50), {
				id: "t1",
				role: "move",
				range,
				laneKey: "a",
			});
		});
		// Move down into lane "b" at clientY 150 (also +? px right; keep X same here).
		act(() => {
			fireEvent.pointerMove(window, { clientX: 50, clientY: 150 });
		});
		expect(result.current.draft?.targetLaneKey).toBe("b");
		expect(result.current.draft?.pointerContentY).toBe(150);

		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 150 });
		});
		// Lane changed a→b, so onCommit's 3rd arg is "b" (dates unchanged: same start/end).
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit.mock.calls[0][0]).toBe("t1");
		expect(onCommit.mock.calls[0][2]).toBe("b");
	});

	it("does not commit a reassign when released in the origin lane with no move", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() =>
			useBarDrag({ onCommit, resolveLaneAt }),
		);
		act(() => {
			result.current.beginDrag(pointerDownEvent(50), {
				id: "t1",
				role: "move",
				range,
				laneKey: "a",
			});
		});
		// Stay in lane "a" (clientY 60), no horizontal move.
		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 60 });
		});
		expect(onCommit).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test use-bar-drag`
Expected: FAIL — draft has no `targetLaneKey`/`pointerContentY`; `onCommit` not receiving the lane / not gated on lane change.

- [ ] **Step 3: Implement the extension**

Edit `apps/web/src/components/timeline/scheduler/use-bar-drag.ts`:

3a. Extend `DragTarget`:

```ts
export type DragTarget = {
	id: string;
	role: DragRole;
	range: RelativeTimeRangeOffset;
	/** The bar's current lane key; used to detect a reassign. Move role only. */
	laneKey?: string;
};
```

3b. Widen the hook's `opts`, return `draft` type, and `onCommit` signature:

```ts
export function useBarDrag(opts: {
	onCommit: (
		id: string,
		dates: { startDate: string; endDate: string },
		targetLaneKey: string | null,
	) => void;
	resolveLaneAt?: (clientY: number) => { key: string | null; contentY: number };
}): {
	draft:
		| {
				id: string;
				range: RelativeTimeRangeOffset;
				targetLaneKey?: string | null;
				pointerContentY?: number;
		  }
		| null;
	active: { id: string; role: DragRole } | null;
	beginDrag: (e: ReactPointerEvent, target: DragTarget) => void;
	wasDragged: () => boolean;
} {
```

Update the `useState` for `draft` to the same widened shape:

```ts
	const [draft, setDraft] = useState<{
		id: string;
		range: RelativeTimeRangeOffset;
		targetLaneKey?: string | null;
		pointerContentY?: number;
	} | null>(null);
```

3c. Inside `beginDrag`, add a helper that resolves the lane (only for `move` with a `resolveLaneAt`), and fold it into the draft. Add near `computeRange`:

```ts
			const resolveLane = (
				clientY: number,
			): { key: string | null; contentY: number } | null => {
				if (target.role !== "move" || !optsRef.current.resolveLaneAt) return null;
				return optsRef.current.resolveLaneAt(clientY);
			};

			const buildDraft = (clientY: number) => {
				const lane = resolveLane(clientY);
				return {
					id: target.id,
					range: computeRange(),
					targetLaneKey: lane ? lane.key : undefined,
					pointerContentY: lane ? lane.contentY : undefined,
				};
			};
```

Replace the three `setDraft({ id: target.id, range: ... })` calls (initial seed, the edgeScroll `onPan` callback, and `onMove`) with `setDraft(buildDraft(<clientY>))`:
- initial seed: `setDraft(buildDraft(e.clientY));`
- edgeScroll callback: `setDraft(buildDraft(lastPointerY));` — add `let lastPointerY = e.clientY;` alongside `lastPointerX`, and set `lastPointerY = ev.clientY;` in `onMove`.
- `onMove`: `setDraft(buildDraft(ev.clientY));`

3d. Rewrite the commit in `onUp` to gate on range-change OR lane-change and pass the lane:

```ts
			const onUp = (ev: PointerEvent) => {
				edgeScroll.stop();
				lastPointerX = ev.clientX;
				lastPointerY = ev.clientY;
				const finalRange = computeRange();
				const lane = resolveLane(ev.clientY);
				const laneChanged =
					lane != null &&
					lane.key != null &&
					lane.key !== target.laneKey;
				const rangeChanged =
					finalRange.from !== target.range.from ||
					finalRange.to !== target.range.to;
				if (rangeChanged || laneChanged) {
					optsRef.current.onCommit(
						target.id,
						rangeToDates(finalRange, todayRef.current),
						laneChanged ? (lane?.key ?? null) : null,
					);
				}
				setDraft(null);
				setActive(null);
				try {
					target0.releasePointerCapture(ev.pointerId);
				} catch {}
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				activeListenersRef.current = null;
			};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test use-bar-drag`
Expected: PASS — the 6 existing tests plus the 2 new lane-tracking tests.

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: clean. `scheduler-layout.tsx`'s existing `onCommit: (id, dates) => {…}` still type-checks (a function accepting fewer params is assignable to the widened type), and it passes no `resolveLaneAt`, so Slice 1 behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-bar-drag.ts apps/web/src/components/timeline/scheduler/use-bar-drag.test.ts
git commit -m "feat(web): extend useBarDrag with vertical lane tracking"
```

---

### Task 2: Reassign wiring + follow-cursor render + highlight

**Files:**
- Modify: `apps/web/src/components/timeline/data/context.tsx` (add `reassignTask`)
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (append)

**Interfaces:**
- Consumes: `useBarDrag` (extended), `SchedulerRow` (`{ key, top, height, assignee? }`).
- Produces: data context gains `reassignTask(id: string, assigneeId: string): void`.
- `SchedulerLanes` gains a prop `laneKeyOf?` is NOT needed — the row key is available in the existing `rows.map((row) => …)` scope and passed inline.

- [ ] **Step 1: Add `reassignTask` to the data context**

In `apps/web/src/components/timeline/data/context.tsx`:

Add to the `TimelineDataValue` type (near `scheduleTask`):

```ts
	reassignTask: (id: string, assigneeId: string) => void;
```

Add the callback (right after the `scheduleTask` `useCallback`):

```ts
	const reassignTask = useCallback(
		(id: string, assigneeId: string) => {
			updateTask.mutate({ id, input: { assigneeId } });
		},
		[updateTask],
	);
```

Add `reassignTask` to the `value` object and its `useMemo` dependency array (mirror how `scheduleTask` is listed in both).

- [ ] **Step 2: Render follow-cursor + target-lane highlight in `SchedulerLanes`**

In `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`:

2a. Widen the `dragDraft` prop type to include the new optional fields (destructure already includes `dragDraft`, `beginDrag`, `wasDragged`):

```tsx
	dragDraft: {
		id: string;
		range: RelativeTimeRangeOffset;
		targetLaneKey?: string | null;
		pointerContentY?: number;
	} | null;
```

2b. Inside the bars map, override the bar's vertical position when this bar is the one being move-dragged (i.e. `pointerContentY` is set). Replace the `const top = row.top + GROUP_PADDING + lane.top;` line with:

```tsx
							const dragging = dragDraft?.id === item.id;
							const top =
								dragging && dragDraft?.pointerContentY != null
									? dragDraft.pointerContentY - height / 2
									: row.top + GROUP_PADDING + lane.top;
```

2c. Pass the current lane key into the body move gesture. Change the button's `onPointerDown`:

```tsx
								onPointerDown={(e) =>
									beginDrag(e, {
										id: item.id,
										role: "move",
										range,
										laneKey: row.key,
									})
								}
```

2d. Render a target-lane highlight band. Inside the top-level `rows.map((row) => …)`, before the `row.lanes.map(...)`, emit a highlight when a move-drag targets this row. Change the `rows.map` body to a block that returns a fragment:

```tsx
				{rows.map((row) => (
					<Fragment key={row.key}>
						{dragDraft?.pointerContentY != null &&
							dragDraft.targetLaneKey === row.key && (
								<div
									data-testid="scheduler-lane-drop-target"
									className="pointer-events-none absolute inset-x-0 rounded-sm bg-primary/10 ring-1 ring-primary/40"
									style={{ top: row.top, height: row.height }}
								/>
							)}
						{row.lanes.map((lane) =>
							lane.bars.map(({ item, range: ownRange }) => {
								/* …existing bar rendering, now using the `top` from 2b… */
							}),
						)}
					</Fragment>
				))}
```

Add `Fragment` to the React import at the top:

```ts
import { Fragment, type PointerEvent as ReactPointerEvent } from "react";
```

- [ ] **Step 3: Provide `resolveLaneAt` + reassign in `scheduler-layout.tsx`**

In `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`:

3a. Destructure `reassignTask`, `projectId`, and `viewportRef` (the last is already destructured from `useTimelineController`); add `reassignTask`, `projectId` to the `useTimelineData()` destructure:

```tsx
	const { items, updateItem, scheduleTask, reassignTask, projectId } =
		useTimelineData();
```

3b. Build `resolveLaneAt` from `rows` and the viewport rect, and wire the reassign in `onCommit`. Replace the current `useBarDrag({ … })` call:

```tsx
	const resolveLaneAt = useCallback(
		(clientY: number) => {
			const top = viewportRef.current?.getBoundingClientRect().top ?? 0;
			const contentY = clientY - top;
			const inRow = rows.find(
				(r) => contentY >= r.top && contentY < r.top + r.height,
			);
			// Clamp to first/last row so a drag past the ends still targets a lane.
			const key =
				inRow?.key ??
				(rows.length === 0
					? null
					: contentY < rows[0].top
						? rows[0].key
						: rows[rows.length - 1].key);
			return { key, contentY };
		},
		[rows, viewportRef],
	);

	const {
		draft: dragDraft,
		beginDrag,
		wasDragged,
	} = useBarDrag({
		onCommit: (id, dates, targetLaneKey) => {
			updateItem(id, dates);
			scheduleTask(id, dates.startDate, dates.endDate);
			if (targetLaneKey != null) {
				const target = rows.find((r) => r.key === targetLaneKey);
				const assignee = target?.assignee;
				updateItem(id, { assignee });
				if (projectId && assignee) reassignTask(id, assignee.id);
			}
		},
		resolveLaneAt,
	});
```

Add `useCallback` to the React import if not already present.

(`SchedulerLanes` is already passed `beginDrag`, `dragDraft`, `wasDragged` from Slice 1 — no call-site change needed.)

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: clean for timeline/scheduler files.

- [ ] **Step 5: Write the failing integration test**

Append to `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`, inside `describe("SchedulerView", …)`:

```ts
	it("dragging a bar into another lane shows a drop target and reassigns it", async () => {
		renderScheduler();
		const headers = await screen.findAllByTestId("scheduler-group-header");
		const firstCountBefore = headers[0].textContent;

		const bar = screen.getAllByTestId("scheduler-bar")[0] as HTMLElement;

		// Body drag downward far past all rows → clamps to the last lane.
		fireEvent.pointerDown(bar, { clientX: 200, clientY: 10, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 200, clientY: 5000 });

		// A drop-target highlight appears for the resolved lane.
		expect(
			screen.getByTestId("scheduler-lane-drop-target"),
		).toBeInTheDocument();

		fireEvent.pointerUp(window, { clientX: 200, clientY: 5000 });

		// The first assignee's lane lost a task (it moved to the last lane).
		const headersAfter = screen.getAllByTestId("scheduler-group-header");
		expect(headersAfter[0].textContent).not.toBe(firstCountBefore);
	});
```

- [ ] **Step 6: Run the integration test**

Run: `cd apps/web && pnpm test scheduler-view`
Expected: PASS. In happy-dom `getBoundingClientRect().top` is `0`, so `contentY = clientY`; `clientY: 5000` is past every row, so `resolveLaneAt` clamps to the last row. The first bar belongs to the first (alphabetically-first) assignee's lane, so reassigning it to the last lane re-buckets it and the first group header's count text changes. If the seed happens to have a single group (no distinct last lane), target a bar known to be in a non-last group by title instead — but the seed has multiple assignees, so index 0 works.

- [ ] **Step 7: Run the full scheduler suite + typecheck**

Run: `cd apps/web && pnpm test scheduler && pnpm typecheck`
Expected: lane-metrics, use-estimate-resize, use-bar-drag, layout, group-rows, pack-lanes, scheduler-view all PASS; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/timeline/data/context.tsx apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "feat(web): scheduler drag-between-lanes to reassign assignee"
```

---

## Self-Review

- **Spec coverage:** 2D move (X+Y) → Task 1; bar-follows-cursor render + target-lane highlight → Task 2 (steps 2b/2d); reassign commit (local + backend, project-mode guard) → Task 2 (steps 1, 3); unassign local-only limitation honored (backend `reassignTask` only called when `assignee` present) → Task 2 step 3b; hit-testing from row geometry → Task 2 step 3a. Tests: hook lane-tracking (Task 1), integration drop-target + re-bucket (Task 2). Covered.
- **Type consistency:** `resolveLaneAt(clientY) → { key: string | null; contentY: number }`, `onCommit(id, dates, targetLaneKey)`, `DragTarget.laneKey`, draft `{ targetLaneKey?, pointerContentY? }`, `reassignTask(id, assigneeId)` used identically across Tasks 1–2 and both components.
- **Backward compatibility:** all Slice-1 call sites keep compiling — `onCommit` widened (fewer-param arrow still assignable), `resolveLaneAt` optional, `target.laneKey` optional. Task 1 leaves the app behavior unchanged until Task 2 supplies `resolveLaneAt`.
- **Untouched files honored:** `layout.ts`, `pack-lanes.ts`, `bars/*` not modified.
- **Placeholder scan:** the step-2d bar-rendering body references "existing bar rendering" — that is a structural wrapper instruction around unchanged code, not a placeholder for new logic; every new code block is shown in full.
