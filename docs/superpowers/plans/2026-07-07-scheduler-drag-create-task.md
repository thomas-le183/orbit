# Scheduler Drag-to-Create Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user drag across an assignee's row in the scheduler view to create a task pre-assigned to that person over the dragged date range, then rename it inline on the new bar.

**Architecture:** Mutations flow through the timeline data context (like the existing `scheduleTask`/`setEstimate`). A new `useLaneCreate` hook owns the drag lifecycle and post-create rename state, mirroring `useBarDrag`/`useEstimateResize`. `scheduler-lanes.tsx` renders a per-row create surface (behind the bars), a dashed ghost during the drag, and swaps a bar's label for an inline `<input>` when it is being renamed. `scheduler-layout.tsx` owns the hook and wires context mutations into it.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest + @testing-library/react. Custom pointer-event handling (no dnd-kit).

## Global Constraints

- Dates are UTC-day ISO strings (`YYYY-MM-DD`); `endDate` is **inclusive**. Copied verbatim from the spec.
- Reuse the existing custom pointer-event pattern (`onPointerDown` → `window` `pointermove`/`pointerup` listeners → cleanup on up/unmount, single-gesture guard). No new drag library.
- Placeholder task name is exactly `"New task"`.
- A real drag past threshold is required to create; a plain click on empty lane space does nothing new (no click-to-create).
- TypeScript: `camelCase` vars/functions, `PascalCase` types. Avoid `any`. Use `cn()` for conditional classes.
- Run all `pnpm` test commands from `apps/web`.

---

### Task 1: Expose `createTask` and `renameTask` on the timeline data context

Add two mutation entry points to the timeline data context so the scheduler can create and rename tasks through the same channel the rest of the timeline already uses (`scheduleTask`, `setEstimate`). Update the four test files that construct a full `TimelineDataValue` mock.

**Files:**
- Modify: `apps/web/src/components/timeline/data/context.tsx`
- Modify (test mocks): `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`, `apps/web/src/components/timeline/layout/split-layout.test.tsx`, `apps/web/src/components/timeline/layout/timeline-table.test.tsx`, `apps/web/src/components/timeline/bars/items-layer.test.tsx`
- Test: `apps/web/src/components/timeline/data/context.test.tsx`

**Interfaces:**
- Produces (added to `TimelineDataValue`):
  - `createTask: (input: CreateTaskInput) => Promise<{ id: string }>`
  - `renameTask: (id: string, name: string) => void`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/timeline/data/context.test.tsx`. First inspect the existing top of that file to reuse its render/mock harness (it already wraps with `QueryClientProvider` and mocks `@/hooks/use-tasks` or `@/lib/api`). Add a `describe` block:

```tsx
import { act, renderHook } from "@testing-library/react";
// (reuse the file's existing QueryClientProvider wrapper + api/use-tasks mocks)

describe("createTask / renameTask", () => {
	it("createTask posts through useCreateTask and resolves the new id", async () => {
		// Arrange: mock the POST so useCreateTask resolves { id: "srv-1" }.
		mockApiPost({ id: "srv-1", name: "New task" }); // helper matching this file's existing api mock style
		const { result } = renderHook(() => useTimelineData(), {
			wrapper: (p) => wrapper({ ...p, projectId: "proj-1" }),
		});

		let created: { id: string } | undefined;
		await act(async () => {
			created = await result.current.createTask({
				name: "New task",
				startDate: "2026-07-08",
				endDate: "2026-07-10",
				assigneeId: "u_ana",
			});
		});

		expect(created).toEqual({ id: "srv-1" });
	});

	it("renameTask optimistically patches the local item then persists the name", async () => {
		const patch = mockApiPatch(); // spy on PATCH /tasks/:id
		const { result } = renderHook(() => useTimelineData(), {
			wrapper: (p) => wrapper({ ...p, projectId: "proj-1" }),
		});

		act(() => {
			result.current.renameTask("t-1", "Renamed");
		});

		expect(patch).toHaveBeenCalledWith(
			"/tasks/t-1",
			expect.objectContaining({ name: "Renamed" }),
		);
	});
});
```

If the existing `context.test.tsx` uses a different mock style (e.g. `vi.mock("@/lib/api")`), adapt `mockApiPost`/`mockApiPatch`/`wrapper` to match exactly what that file already does — do not introduce a second mocking convention.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- data/context.test.tsx`
Expected: FAIL — `result.current.createTask is not a function` (and same for `renameTask`).

- [ ] **Step 3: Implement the context additions**

In `apps/web/src/components/timeline/data/context.tsx`:

Add imports (merge into existing import lines):

```tsx
import type { CreateTaskInput } from "@orbit/shared";
import { useCreateTask, useUpdateTask /* existing */ } from "@/hooks/use-tasks";
```

Add to the `TimelineDataValue` type (near `scheduleTask`/`setEstimate`):

```tsx
	createTask: (input: CreateTaskInput) => Promise<{ id: string }>;
	renameTask: (id: string, name: string) => void;
```

In `TimelineDataProvider`, alongside the other mutation hooks (e.g. after `const updateTask = useUpdateTask(projectId ?? "");`):

```tsx
	const createTaskMut = useCreateTask(projectId ?? "");
```

Add the two callbacks near `scheduleTask`/`setEstimate`:

```tsx
	const createTask = useCallback(
		(input: CreateTaskInput) => createTaskMut.mutateAsync(input),
		[createTaskMut],
	);

	const renameTask = useCallback(
		(id: string, name: string) => {
			// Reflect locally at once (like scheduleTask's caller does), then persist.
			updateItem(id, { name });
			updateTask.mutate({ id, input: { name } });
		},
		[updateItem, updateTask],
	);
```

Add `createTask` and `renameTask` to the `value` object and to its `useMemo` dependency array.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- data/context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update the four `TimelineDataValue` mocks**

In each of `scheduler-view.test.tsx`, `split-layout.test.tsx`, `timeline-table.test.tsx`, `items-layer.test.tsx`, find the object literal that builds the full timeline-data value (search for `setEstimate:`) and add these two properties next to `setEstimate: vi.fn(),`:

```tsx
			createTask: vi.fn(() => Promise.resolve({ id: "new-task" })),
			renameTask: vi.fn(),
```

- [ ] **Step 6: Run the full timeline test suite to verify no mock breaks**

Run: `pnpm test -- components/timeline`
Expected: PASS (all existing tests green with the two new mock fields present).

- [ ] **Step 7: Typecheck**

Run (from repo root): `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/timeline/data/context.tsx apps/web/src/components/timeline/data/context.test.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx apps/web/src/components/timeline/layout/split-layout.test.tsx apps/web/src/components/timeline/layout/timeline-table.test.tsx apps/web/src/components/timeline/bars/items-layer.test.tsx
git commit -m "feat(web): expose createTask and renameTask on timeline data context"
```

---

### Task 2: `useLaneCreate` drag hook

A hook that owns the create-drag lifecycle and the post-create rename target. It reuses the pure `draftRangeFromDrag` for clientX→date math and mirrors the pointer lifecycle of `useEstimateResize` (window listeners, single-gesture guard, unmount cleanup). It takes geometry and an async `onCreate` callback as options so it is unit-testable without providers.

**Files:**
- Create: `apps/web/src/components/timeline/scheduler/use-lane-create.ts`
- Test: `apps/web/src/components/timeline/scheduler/use-lane-create.test.ts`

**Interfaces:**
- Consumes: `draftRangeFromDrag` from `../draft/draft-range`; `Geometry` from `../controller/geometry`.
- Produces:
  - `type LaneCreateDraft = { laneKey: string; startDate: string; endDate: string }`
  - ```ts
    useLaneCreate(opts: {
      geom: Geometry;
      today: number;
      onCreate: (input: {
        name: string;
        startDate: string;
        endDate: string;
        assigneeId?: string;
      }) => Promise<{ id: string }>;
    }): {
      draft: LaneCreateDraft | null;
      beginCreate: (
        e: ReactPointerEvent,
        row: { key: string; assigneeId?: string },
      ) => void;
      renamingId: string | null;
      clearRenaming: () => void;
    }
    ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/scheduler/use-lane-create.test.ts`:

```ts
import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Geometry } from "../controller/geometry";
import { startOfUtcDay } from "../units/make-units";
import { useLaneCreate } from "./use-lane-create";

const geom: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 800 };
const today = startOfUtcDay(Date.UTC(2026, 6, 7)); // 2026-07-07

/** Minimal ReactPointerEvent stand-in over a lane rect of left=0 width=800. */
function pointerDownEvent(clientX: number) {
	return {
		clientX,
		pointerId: 1,
		currentTarget: {
			getBoundingClientRect: () => ({ left: 0, width: 800 }),
		},
		preventDefault: vi.fn(),
	} as unknown as React.PointerEvent;
}

describe("useLaneCreate", () => {
	it("creates a task with the dragged dates and the row's assignee on release", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-1" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), {
				key: "u_ana",
				assigneeId: "u_ana",
			});
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		// The ghost draft is live during the drag.
		expect(result.current.draft?.laneKey).toBe("u_ana");

		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});

		expect(onCreate).toHaveBeenCalledTimes(1);
		const arg = onCreate.mock.calls[0][0];
		expect(arg).toMatchObject({ name: "New task", assigneeId: "u_ana" });
		expect(typeof arg.startDate).toBe("string");
		expect(typeof arg.endDate).toBe("string");
		expect(arg.startDate <= arg.endDate).toBe(true);
		// After create resolves, that task enters rename mode.
		expect(result.current.renamingId).toBe("srv-1");
		expect(result.current.draft).toBeNull();
	});

	it("does not create on a click (no drag past threshold)", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-1" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(200), { key: "u_ana" });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 200 });
		});

		expect(onCreate).not.toHaveBeenCalled();
		expect(result.current.renamingId).toBeNull();
	});

	it("omits assigneeId when the row has none (Unassigned)", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-2" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "unassigned" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect("assigneeId" in onCreate.mock.calls[0][0]).toBe(false);
	});

	it("ignores a second beginCreate while a gesture is active", () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "x" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);
		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "a" });
		});
		act(() => {
			result.current.beginCreate(pointerDownEvent(500), { key: "b" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		expect(result.current.draft?.laneKey).toBe("a");
	});

	it("clearRenaming resets the rename target", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-3" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);
		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "a" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});
		expect(result.current.renamingId).toBe("srv-3");
		act(() => {
			result.current.clearRenaming();
		});
		expect(result.current.renamingId).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- use-lane-create.test.ts`
Expected: FAIL — cannot find module `./use-lane-create`.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/components/timeline/scheduler/use-lane-create.ts`:

```ts
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Geometry } from "../controller/geometry";
import { draftRangeFromDrag } from "../draft/draft-range";

/**
 * Horizontal travel (px) past which a press counts as a create-drag. Must be
 * >= draft-range's CLICK_THRESHOLD_PX (4) so that any release we act on always
 * maps to the dragged span, never draftRangeFromDrag's default-span branch.
 */
const CREATE_DRAG_THRESHOLD_PX = 4;

export type LaneCreateDraft = {
	laneKey: string;
	startDate: string;
	endDate: string;
};

/**
 * Pointer-driven "drag on an empty assignee lane to create a task" gesture.
 * Sketches a live date range (ghost) during the drag and, on release past the
 * threshold, creates a task pre-assigned to the row and marks it for inline
 * rename. Mirrors useEstimateResize's lifecycle (window listeners, single-
 * gesture guard, unmount cleanup); reuses draftRangeFromDrag for the math.
 */
export function useLaneCreate(opts: {
	geom: Geometry;
	today: number;
	onCreate: (input: {
		name: string;
		startDate: string;
		endDate: string;
		assigneeId?: string;
	}) => Promise<{ id: string }>;
}): {
	draft: LaneCreateDraft | null;
	beginCreate: (
		e: ReactPointerEvent,
		row: { key: string; assigneeId?: string },
	) => void;
	renamingId: string | null;
	clearRenaming: () => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const listenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);

	const [draft, setDraft] = useState<LaneCreateDraft | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			if (listenersRef.current) {
				window.removeEventListener("pointermove", listenersRef.current.move);
				window.removeEventListener("pointerup", listenersRef.current.up);
				listenersRef.current = null;
			}
		};
	}, []);

	const clearRenaming = useCallback(() => setRenamingId(null), []);

	const beginCreate = useCallback(
		(e: ReactPointerEvent, row: { key: string; assigneeId?: string }) => {
			if (listenersRef.current) return;
			e.preventDefault();
			const rect = e.currentTarget.getBoundingClientRect();
			const startX = e.clientX;
			let moved = false;
			let lastX = startX;

			const rangeAt = (clientX: number) =>
				draftRangeFromDrag(
					startX,
					clientX,
					rect,
					optsRef.current.geom,
					optsRef.current.today,
				);

			const onMove = (ev: PointerEvent) => {
				lastX = ev.clientX;
				if (Math.abs(ev.clientX - startX) > CREATE_DRAG_THRESHOLD_PX) {
					moved = true;
				}
				if (moved) {
					const r = rangeAt(ev.clientX);
					setDraft({ laneKey: row.key, ...r });
				}
			};

			const onUp = () => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				listenersRef.current = null;
				setDraft(null);
				if (!moved) return;
				const r = rangeAt(lastX);
				optsRef.current
					.onCreate({
						name: "New task",
						startDate: r.startDate,
						endDate: r.endDate,
						...(row.assigneeId ? { assigneeId: row.assigneeId } : {}),
					})
					.then((task) => setRenamingId(task.id))
					.catch(() => {
						/* create failed: useCreateTask surfaces the error toast */
					});
			};

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			listenersRef.current = { move: onMove, up: onUp };
		},
		[],
	);

	return { draft, beginCreate, renamingId, clearRenaming };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- use-lane-create.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/use-lane-create.ts apps/web/src/components/timeline/scheduler/use-lane-create.test.ts
git commit -m "feat(web): add useLaneCreate drag hook for scheduler task creation"
```

---

### Task 3: Wire the create surface, ghost, and inline rename into the scheduler

Render a per-row create surface (behind the bars) and a dashed create-preview in `scheduler-lanes.tsx`, swap a bar's label for an inline `<input>` when it is the rename target, and own `useLaneCreate` in `scheduler-layout.tsx`.

**Files:**
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`
- Modify: `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`
- Test: `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx`

**Interfaces:**
- Consumes: `useLaneCreate`, `LaneCreateDraft` (Task 2); `createTask`, `renameTask` (Task 1); `useHorizontalPercentageOffset`, `startOfUtcDay`, `ONE_DAY` (existing).
- `SchedulerLanes` gains props:
  - `beginCreate: (e: ReactPointerEvent, row: { key: string; assigneeId?: string }) => void`
  - `createDraft: LaneCreateDraft | null`
  - `renamingId: string | null`
  - `onRename: (id: string, name: string) => void`
  - `clearRenaming: () => void`

- [ ] **Step 1: Write the failing integration tests**

Add to `apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx` (inside the existing `describe("SchedulerView", ...)`). These reuse the file's existing harness (`renderScheduler`, `defaultTimelineData`, the 800px ResizeObserver mock, `dateAt`).

```tsx
	it("shows a dashed create preview while dragging on an empty lane", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		const surface = screen.getAllByTestId("scheduler-create-surface")[0];
		fireEvent.pointerDown(surface, { clientX: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 300 });

		expect(
			screen.getByTestId("scheduler-create-preview"),
		).toBeInTheDocument();

		fireEvent.pointerUp(window, { clientX: 300 });
	});

	it("dragging on an assignee lane creates a 'New task' for that assignee", async () => {
		const createTask = vi.fn(() => Promise.resolve({ id: "new-task" }));
		function Bridge({ children }: { children: ReactNode }) {
			const [items, setItems] = useState<TimelineItem[]>(seedItems);
			vi.mocked(useTimelineData).mockReturnValue(
				defaultTimelineData({
					items,
					updateItem: (id, patch) =>
						setItems((prev) =>
							prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
						),
					createTask,
				}),
			);
			return <>{children}</>;
		}
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={qc}>
				<TimelineDataProvider>
					<Bridge>
						<SchedulerView />
					</Bridge>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		await screen.findAllByTestId("scheduler-group-header");

		// First lane belongs to the alphabetically-first assignee (Ana Alpha).
		const surface = screen.getAllByTestId("scheduler-create-surface")[0];
		fireEvent.pointerDown(surface, { clientX: 200, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 380 });
		fireEvent.pointerUp(window, { clientX: 380 });

		expect(createTask).toHaveBeenCalledTimes(1);
		expect(createTask.mock.calls[0][0]).toMatchObject({
			name: "New task",
			assigneeId: "u_ana",
		});
	});

	it("renames a task inline: Enter commits via renameTask", async () => {
		const renameTask = vi.fn();
		// createTask appends a dated bar for Ana and resolves its id so it
		// renders and enters rename mode.
		function Bridge({ children }: { children: ReactNode }) {
			const [items, setItems] = useState<TimelineItem[]>(seedItems);
			const createTask = vi.fn((input: { assigneeId?: string }) => {
				const created: TimelineItem = {
					id: "created-1",
					kind: "task",
					name: "New task",
					parentId: null,
					startDate: dateAt(0),
					endDate: dateAt(1),
					progress: 0,
					color: "#3b82f6",
					assignee: {
						id: "u_ana",
						name: "Ana Alpha",
						avatarUrl: "https://i.pravatar.cc/64?u=ana",
					},
					estimatedTime: 90,
				};
				setItems((prev) => [...prev, created]);
				return Promise.resolve({ id: created.id });
			});
			vi.mocked(useTimelineData).mockReturnValue(
				defaultTimelineData({
					items,
					updateItem: (id, patch) =>
						setItems((prev) =>
							prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
						),
					createTask,
					renameTask,
				}),
			);
			return <>{children}</>;
		}
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={qc}>
				<TimelineDataProvider>
					<Bridge>
						<SchedulerView />
					</Bridge>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		await screen.findAllByTestId("scheduler-group-header");

		const surface = screen.getAllByTestId("scheduler-create-surface")[0];
		fireEvent.pointerDown(surface, { clientX: 200, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 380 });
		fireEvent.pointerUp(window, { clientX: 380 });

		const input = await screen.findByTestId("scheduler-bar-rename-input");
		fireEvent.change(input, { target: { value: "Design review" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(renameTask).toHaveBeenCalledWith("created-1", "Design review");
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- scheduler-view.test.tsx`
Expected: FAIL — no `scheduler-create-surface` element (and the new props don't exist yet).

- [ ] **Step 3: Add the new props and rendering to `SchedulerLanes`**

In `apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx`:

Add imports at the top (merge with existing):

```tsx
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import { ROW_PADDING } from "../layout/row-metrics";
import type { LaneCreateDraft } from "./use-lane-create";
```

Extend the component's prop type with:

```tsx
	beginCreate: (
		e: ReactPointerEvent,
		row: { key: string; assigneeId?: string },
	) => void;
	createDraft: LaneCreateDraft | null;
	renamingId: string | null;
	onRename: (id: string, name: string) => void;
	clearRenaming: () => void;
```

Destructure them from props alongside the existing ones, and pull `getPercentageOffset`/`today` (`today` from `useTimelineController()`, already exposing it elsewhere — add it to the existing destructure of `useTimelineController()`).

Inside `rows.map((row) => (...))`, as the FIRST children of the row `<Fragment>` (before the drop-target and bars, so bars paint on top and keep their own gestures), add the create surface and the ghost:

```tsx
						<div
							data-testid="scheduler-create-surface"
							onPointerDown={(e) =>
								beginCreate(e, { key: row.key, assigneeId: row.assignee?.id })
							}
							className="pointer-events-auto absolute inset-x-0 cursor-crosshair"
							style={{ top: row.top, height: row.height }}
						/>
						{createDraft?.laneKey === row.key &&
							(() => {
								const left = getPercentageOffset(
									startOfUtcDay(Date.parse(createDraft.startDate)) - today,
								);
								const right = getPercentageOffset(
									startOfUtcDay(Date.parse(createDraft.endDate)) -
										today +
										ONE_DAY,
								);
								if (!Number.isFinite(left) || !Number.isFinite(right)) {
									return null;
								}
								return (
									<span
										data-testid="scheduler-create-preview"
										className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/60 bg-primary/15"
										style={{
											left: `${left}%`,
											width: `${Math.max(right - left, 0)}%`,
											top: row.top + ROW_PADDING,
											height: row.height - ROW_PADDING * 2,
										}}
									/>
								);
							})()}
```

(Remove the stray `assignee: undefined,` key — the `beginCreate` row arg is only `{ key, assigneeId }`; write it as `beginCreate(e, { key: row.key, assigneeId: row.assignee?.id })`.)

In the bar render (`lane.bars.map(({ item, range: ownRange }) => {...})`), before the `return <button ...>`, branch on rename mode. Replace the single `return (<button ...>...)` with:

```tsx
								if (renamingId === item.id) {
									return (
										<div
											key={item.id}
											data-testid="scheduler-bar-renaming"
											style={{
												left: `calc(${left}% + ${BAR_INLINE_INSET_PX}px)`,
												width: `calc(${width}% - ${BAR_INLINE_INSET_PX * 2}px)`,
												top,
												height,
												backgroundColor: item.color,
											}}
											className="pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 shadow-sm ring-2 ring-primary"
											onPointerDown={(e) => e.stopPropagation()}
										>
											<input
												data-testid="scheduler-bar-rename-input"
												aria-label="Rename task"
												defaultValue={item.name}
												autoFocus
												onFocus={(e) => e.currentTarget.select()}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														const v = e.currentTarget.value.trim();
														if (v && v !== item.name) onRename(item.id, v);
														clearRenaming();
													} else if (e.key === "Escape") {
														e.preventDefault();
														clearRenaming();
													}
												}}
												onBlur={(e) => {
													const v = e.currentTarget.value.trim();
													if (v && v !== item.name) onRename(item.id, v);
													clearRenaming();
												}}
												className="w-full bg-transparent text-xs font-medium text-white outline-none placeholder:text-white/70"
											/>
										</div>
									);
								}
```

Keep the existing `<button ...>` return as the else path (leave it unchanged).

- [ ] **Step 4: Own `useLaneCreate` in `scheduler-layout.tsx` and pass the props**

In `apps/web/src/components/timeline/scheduler/scheduler-layout.tsx`:

Add imports:

```tsx
import { useLaneCreate } from "./use-lane-create";
```

Add `offsetMs` to the `useTimelineController()` destructure (needed to build `Geometry`).

Pull the two new mutations from data context (extend the existing destructure of `useTimelineData()`):

```tsx
	const { items, assignees, updateItem, scheduleTask, setEstimate, createTask, renameTask } =
		useTimelineData();
```

After `rows`/`totalHeight` are computed, instantiate the hook:

```tsx
	const {
		draft: createDraft,
		beginCreate,
		renamingId,
		clearRenaming,
	} = useLaneCreate({
		geom: { offsetMs, zoom: zoomLevel, viewportWidth },
		today,
		onCreate: createTask,
	});
```

Pass the new props to `<SchedulerLanes ... />`:

```tsx
						beginCreate={beginCreate}
						createDraft={createDraft}
						renamingId={renamingId}
						onRename={renameTask}
						clearRenaming={clearRenaming}
```

- [ ] **Step 5: Run the integration tests to verify they pass**

Run: `pnpm test -- scheduler-view.test.tsx`
Expected: PASS (existing tests plus the three new ones).

- [ ] **Step 6: Run the full timeline suite + typecheck + lint**

Run: `pnpm test -- components/timeline`
Expected: PASS.
Run (repo root): `pnpm typecheck`
Expected: no errors.
Run (repo root): `pnpm check`
Expected: no lint/format errors (fix any Biome findings in the changed files).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/scheduler/scheduler-lanes.tsx apps/web/src/components/timeline/scheduler/scheduler-layout.tsx apps/web/src/components/timeline/scheduler/scheduler-view.test.tsx
git commit -m "feat(web): drag on a scheduler row to create and inline-rename a task"
```

---

## Manual verification

After Task 3, run the app (`pnpm dev`), open a project's scheduler view, and:
1. Drag horizontally across an empty part of an assignee's row → a dashed ghost tracks the drag.
2. Release → a "New task" bar appears in that row with an inline input focused and text selected.
3. Type a name, press Enter → the bar shows the new name; it is assigned to that person with the dragged dates.
4. Repeat on the "Unassigned" row → the task is created without an assignee.
5. A plain click on empty lane space → nothing is created.
6. Press Escape while renaming → the bar keeps "New task".

## Self-review notes

- **Spec coverage:** interaction model (Task 3 surface + ghost + drag-required via Task 2 threshold), instant create + inline rename (Tasks 1–3), per-assignee + Unassigned (Task 2 `assigneeId` omission, Task 3 first-lane test), edge cases (empty-name guard in Task 3 input handlers; create-failure caught in Task 2), testing (all three tasks).
- **Type consistency:** `createTask: (CreateTaskInput) => Promise<{id: string}>` in Task 1 is compatible with `useLaneCreate`'s `onCreate: (...) => Promise<{id: string}>` in Task 2; `LaneCreateDraft`/`createDraft`/`renamingId`/`clearRenaming`/`onRename` names match across Tasks 2 and 3.
- **Threshold:** `CREATE_DRAG_THRESHOLD_PX (4) >= draft-range CLICK_THRESHOLD_PX (4)` guarantees acted-on releases use the dragged span, never the default-span branch.
