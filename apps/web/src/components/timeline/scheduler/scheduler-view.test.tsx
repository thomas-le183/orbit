import type { CreateTaskInput } from "@orbit/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { TimelineDataProvider, useTimelineData } from "../data/context";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";
import SchedulerView from "./scheduler-view";

vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

// SchedulerLayout reads weekStart from usePreferences, which otherwise issues a
// real /preferences request per mount. Those requests never resolve under
// happy-dom and starve the file's 5s test timeout once enough tests mount the
// view, so pin it to the same default the component falls back to.
vi.mock("@/hooks/use-preferences", () => ({
	usePreferences: () => ({ data: { weekStart: 1 } }),
}));

// Only bars whose dates overlap the (today-centered) visible viewport are
// rendered by the scheduler at the default "weeks" zoom (~17 visible days),
// so every task here must be dated close to "today". Dates are computed as
// day offsets from today (rather than hardcoded) so the fixture doesn't
// bit-rot as the real calendar date advances.
const today = startOfUtcDay(Date.now());
const dateAt = (offsetDays: number) =>
	toUtcDateString(today + offsetDays * ONE_DAY);

// Fixture standing in for the removed timeline-items seed. Groups sort
// alphabetically by assignee name (see group-rows.ts). "Ana Alpha" has two
// tasks so that dragging its first (and, being alphabetically first,
// DOM-first) bar into the last lane leaves a distinguishable non-zero count
// behind.
const seedItems: TimelineItem[] = [
	{
		id: "t-ana-1",
		kind: "task",
		name: "Ana task one",
		parentId: null,
		startDate: dateAt(-6),
		endDate: dateAt(-4),
		progress: 0,
		color: "#ec4899",
		assignee: {
			id: "u_ana",
			name: "Ana Alpha",
			avatarUrl: "https://i.pravatar.cc/64?u=ana",
		},
		estimatedTime: 90,
	},
	{
		id: "t-ana-2",
		kind: "task",
		name: "Ana task two",
		parentId: null,
		startDate: dateAt(-3),
		endDate: dateAt(-2),
		progress: 0,
		color: "#ec4899",
		assignee: {
			id: "u_ana",
			name: "Ana Alpha",
			avatarUrl: "https://i.pravatar.cc/64?u=ana",
		},
		estimatedTime: 90,
	},
	{
		id: "t-maya",
		kind: "task",
		name: "API schema & data model",
		parentId: null,
		startDate: dateAt(-1),
		endDate: dateAt(1),
		progress: 40,
		color: "#f59e0b",
		assignee: {
			id: "u_maya",
			name: "Maya Chen",
			avatarUrl: "https://i.pravatar.cc/64?u=maya",
		},
		estimatedTime: 300,
	},
	{
		id: "t-zack",
		kind: "task",
		name: "Zack task",
		parentId: null,
		startDate: dateAt(2),
		endDate: dateAt(4),
		progress: 0,
		color: "#ef4444",
		assignee: {
			id: "u_zack",
			name: "Zack Omega",
			avatarUrl: "https://i.pravatar.cc/64?u=zack",
		},
		estimatedTime: 900,
	},
];

function defaultTimelineData(
	overrides: Partial<ReturnType<typeof useTimelineData>> = {},
): ReturnType<typeof useTimelineData> {
	return {
		items: seedItems,
		assignees: [],
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		undatedTaskRows: [],
		scheduleTask: vi.fn(),
		setEstimate: vi.fn(),
		createTask: vi.fn((_input: CreateTaskInput) =>
			Promise.resolve({ id: "new-task" }),
		),
		renameTask: vi.fn(),
		milestoneMarkers: [],
		isLoading: false,
		isError: false,
		projectId: undefined,
		dependencies: [],
		createDependency: vi.fn(),
		deleteDependency: vi.fn(),
		...overrides,
	};
}

/**
 * Bridges the mocked `useTimelineData` to real React state so drag/resize
 * gestures (which call `updateItem`/`scheduleTask`) actually re-render with
 * updated positions/heights/assignees, mirroring TimelineDataProvider's real
 * local-state logic (see items-layer.test.tsx for the same pattern).
 */
function SeedDataBridge({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<TimelineItem[]>(seedItems);
	vi.mocked(useTimelineData).mockReturnValue(
		defaultTimelineData({
			items,
			updateItem: (id, patch) =>
				setItems((prev) =>
					prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
				),
		}),
	);
	return <>{children}</>;
}

// The scheduler viewport measures width via useResizeObserver; happy-dom
// emits no size, so mock ResizeObserver to fire once at 800px (mirrors
// split-layout.test.tsx).
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

function renderScheduler() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={qc}>
			<TimelineDataProvider>
				<SeedDataBridge>
					<SchedulerView />
				</SeedDataBridge>
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
}

/**
 * Same bridge as SeedDataBridge, but captures a stable `setEstimate` spy
 * (created once, outside the mock factory) so assertions can be made on it
 * after re-renders triggered by the resize gesture's optimistic update.
 */
function renderSchedulerWithEstimateSpy() {
	const setEstimate = vi.fn();
	const scheduleTask = vi.fn();
	function Bridge({ children }: { children: ReactNode }) {
		const [items, setItems] = useState<TimelineItem[]>(seedItems);
		vi.mocked(useTimelineData).mockReturnValue(
			defaultTimelineData({
				items,
				updateItem: (id, patch) =>
					setItems((prev) =>
						prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
					),
				setEstimate,
				scheduleTask,
			}),
		);
		return <>{children}</>;
	}
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={qc}>
			<TimelineDataProvider>
				<Bridge>
					<SchedulerView />
				</Bridge>
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
	return { setEstimate, scheduleTask };
}

describe("SchedulerView", () => {
	it("renders per-assignee group headers from seed data", async () => {
		renderScheduler();
		const headers = await screen.findAllByTestId("scheduler-group-header");
		expect(headers.length).toBeGreaterThan(0);
		// Seed data assigns tasks to named users.
		expect(screen.getByText("Maya Chen")).toBeInTheDocument();
	});

	it("renders a per-day workload band atop rows with estimated tasks", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		// Every seeded task carries an estimate dated inside the viewport, so each
		// assignee row gets a workload strip with at least one per-day cell.
		const strips = screen.getAllByTestId("workload-strip");
		expect(strips.length).toBeGreaterThan(0);
		const cells = screen.getAllByTestId("workload-cell");
		expect(cells.length).toBeGreaterThan(0);
		// Each cell records whether its day is over capacity.
		for (const cell of cells) {
			expect(cell.getAttribute("data-overloaded")).toMatch(/^(true|false)$/);
		}
	});

	it("shows an empty-state band for an assignee with no workload", async () => {
		vi.mocked(useTimelineData).mockReturnValue(
			defaultTimelineData({
				items: [],
				assignees: [{ id: "u_idle", name: "Idle Ian", avatarUrl: "" }],
			}),
		);
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={qc}>
				<TimelineDataProvider>
					<SchedulerView />
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		await screen.findAllByTestId("scheduler-group-header");

		// The band renders an empty placeholder rather than nothing, and no cells.
		expect(screen.getByTestId("workload-strip-empty")).toBeInTheDocument();
		expect(screen.getByText("No workload")).toBeInTheDocument();
		expect(screen.queryAllByTestId("workload-cell")).toHaveLength(0);
	});

	it("collapsing a row hides its task bars but keeps its workload band", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		const barsBefore = screen.getAllByTestId("scheduler-bar").length;
		const stripsBefore = screen.getAllByTestId("workload-strip").length;
		// Ana Alpha sorts first and owns two of the seeded bars.
		const [firstToggle] = screen.getAllByTestId("scheduler-group-collapse");
		expect(firstToggle.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(firstToggle);

		expect(firstToggle.getAttribute("aria-expanded")).toBe("false");
		// Two of Ana's bars are gone; the rest remain.
		expect(screen.getAllByTestId("scheduler-bar").length).toBe(barsBefore - 2);
		// The band is still rendered for every row (including the collapsed one).
		expect(screen.getAllByTestId("workload-strip").length).toBe(stripsBefore);
	});

	it("drag on a bar's resize handle sets its height to the clamped max", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		// Task bars carry a resize handle; milestones do not.
		const handles = screen.getAllByTestId("scheduler-bar-resize");
		expect(handles.length).toBeGreaterThan(0);
		const handle = handles[0];
		const bar = handle.closest("[data-testid='scheduler-bar']") as HTMLElement;

		// Drag far downward: any startHeight + large dy clamps to MAX height
		// (max per-day effort → 160px), whatever the task's day span.
		fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientY: 400 });
		fireEvent.pointerUp(window, { clientY: 400 });

		expect(bar.style.height).toBe("160px");
	});

	it("committing a bar resize persists the estimate via setEstimate", async () => {
		const { setEstimate } = renderSchedulerWithEstimateSpy();
		await screen.findAllByTestId("scheduler-group-header");

		// Target a specific, known bar so we can assert on its id.
		const bar = screen.getByTitle("Ana task one");
		const handle = within(bar).getByTestId("scheduler-bar-resize");

		fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientY: 400 });
		fireEvent.pointerUp(window, { clientY: 400 });

		// The resize wiring in scheduler-layout.tsx must call setEstimate (API
		// persistence), not just updateItem (optimistic local state), on commit.
		expect(setEstimate).toHaveBeenCalledWith("t-ana-1", expect.any(Number));
	});

	it("horizontal resize holds per-day effort and PATCHes dates + estimate in one call", async () => {
		const { scheduleTask, setEstimate } = renderSchedulerWithEstimateSpy();
		await screen.findAllByTestId("scheduler-group-header");

		// "Ana task one" spans 3 inclusive days (offset -6..-4) at 90m → 30m/day.
		const bar = screen.getByTitle("Ana task one");
		const handle = within(bar).getByTestId("scheduler-bar-resize-end");

		// Drag the end edge +128px = +2 days at weeks zoom (64px/day) → 5-day span.
		fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 228 });
		fireEvent.pointerUp(window, { clientX: 228 });

		// One PATCH carries the new dates AND the rescaled estimate; the per-day
		// effort is held constant, so 30m/day × 5 days = 150m. No second call.
		expect(scheduleTask).toHaveBeenCalledTimes(1);
		const [id, , , , estimatedTime] = scheduleTask.mock.calls[0];
		expect(id).toBe("t-ana-1");
		expect(estimatedTime).toBe(150);
		expect(setEstimate).not.toHaveBeenCalled();
	});

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

	it("shows a dashed create preview while dragging on an empty lane", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		const surface = screen.getAllByTestId("scheduler-create-surface")[0];
		fireEvent.pointerDown(surface, { clientX: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 300 });

		expect(screen.getByTestId("scheduler-create-preview")).toBeInTheDocument();

		fireEvent.pointerUp(window, { clientX: 300 });
	});

	it("dragging on an assignee lane creates a 'New task' for that assignee", async () => {
		const createTask = vi.fn((_input: CreateTaskInput) =>
			Promise.resolve({ id: "new-task" }),
		);
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
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
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
			const createTask = vi.fn((_input: { assigneeId?: string }) => {
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
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
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
		// Enter must commit exactly once. (happy-dom does not fire the native
		// unmount-blur that a real browser would, so this asserts the single-
		// commit intent guarded by renameCommittedRef rather than reproducing
		// the browser double-fire path.)
		expect(renameTask).toHaveBeenCalledTimes(1);
	});

	it("tints the timeline header while dragging a bar, and clears on release", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");
		const bar = screen.getAllByTestId("scheduler-bar")[0] as HTMLElement;

		fireEvent.pointerDown(bar, { clientX: 200, clientY: 50, pointerId: 1 });
		// No movement yet: `active` is set but `pointer` is not, so the header
		// must not tint on pointerdown alone.
		expect(document.querySelectorAll("[data-highlighted='true']").length).toBe(
			0,
		);

		fireEvent.pointerMove(window, { clientX: 360, clientY: 50 });
		// The provider must enclose both the header (TimeUnitsBar) and the body
		// so the drag range reaches the header cells and tints at least one.
		expect(
			document.querySelectorAll("[data-highlighted='true']").length,
		).toBeGreaterThan(0);

		fireEvent.pointerUp(window, { clientX: 360, clientY: 50 });
		expect(document.querySelectorAll("[data-highlighted='true']").length).toBe(
			0,
		);
	});
});

describe("unplanned panel", () => {
	const undated = [
		{ id: "u-1", name: "Write launch copy", parentId: null },
		{ id: "u-2", name: "Audit billing flow", parentId: null },
	];

	function renderWithUndated(
		overrides: Partial<ReturnType<typeof useTimelineData>> = {},
	) {
		vi.mocked(useTimelineData).mockReturnValue(
			defaultTimelineData({ undatedTaskRows: undated, ...overrides }),
		);
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const utils = render(
			<QueryClientProvider client={qc}>
				<TimelineDataProvider>
					<SchedulerView />
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		// The unplanned panel is hidden by default; open it so the tests below can
		// assert against it (leaves state identical to a user opening the panel).
		fireEvent.click(screen.getByLabelText("Toggle unplanned tasks"));
		return utils;
	}

	function composer() {
		const panel = screen.getByTestId("scheduler-unplanned-panel");
		return within(panel).getByLabelText("New task name") as HTMLInputElement;
	}

	it("lists every undated task with a count", () => {
		renderWithUndated();
		const panel = screen.getByTestId("scheduler-unplanned-panel");
		expect(within(panel).getAllByTestId("unplanned-task")).toHaveLength(2);
		expect(within(panel).getByText("Write launch copy")).toBeTruthy();
		expect(within(panel).getByText("Audit billing flow")).toBeTruthy();
	});

	it("filters the list by name, case-insensitively", () => {
		renderWithUndated();
		const panel = screen.getByTestId("scheduler-unplanned-panel");
		fireEvent.change(within(panel).getByLabelText("Search unplanned tasks"), {
			target: { value: "BILLING" },
		});
		const rows = within(panel).getAllByTestId("unplanned-task");
		expect(rows).toHaveLength(1);
		expect(rows[0].textContent).toBe("Audit billing flow");
	});

	it("shows a no-matches message when the query matches nothing", () => {
		renderWithUndated();
		const panel = screen.getByTestId("scheduler-unplanned-panel");
		fireEvent.change(within(panel).getByLabelText("Search unplanned tasks"), {
			target: { value: "zzz" },
		});
		expect(within(panel).queryByTestId("unplanned-task")).toBeNull();
		expect(within(panel).getByText("No matches")).toBeTruthy();
	});

	it("submitting the composer creates a task with no dates", async () => {
		const createTask = vi.fn(() => Promise.resolve({ id: "created" }));
		renderWithUndated({ projectId: "proj-1", createTask });

		const input = composer();
		fireEvent.change(input, { target: { value: "  Draft the RFC  " } });
		fireEvent.submit(input.closest("form") as HTMLFormElement);

		// Trimmed name, and crucially no startDate/endDate — that is what keeps
		// the new task in the unplanned bucket.
		expect(createTask).toHaveBeenCalledWith({ name: "Draft the RFC" });
		await waitFor(() => expect(composer().value).toBe(""));
	});

	it("does not create a task from a blank or whitespace-only name", () => {
		const createTask = vi.fn(() => Promise.resolve({ id: "created" }));
		renderWithUndated({ projectId: "proj-1", createTask });

		const input = composer();
		const form = input.closest("form") as HTMLFormElement;

		fireEvent.submit(form);
		fireEvent.change(input, { target: { value: "   " } });
		fireEvent.submit(form);

		expect(createTask).not.toHaveBeenCalled();
	});

	it("disables the composer when no project is selected", () => {
		renderWithUndated({ projectId: undefined });
		expect(composer().disabled).toBe(true);
	});

	/**
	 * The drop hook hit-tests the pointer against the lanes viewport's real box;
	 * happy-dom reports an all-zero rect, so give it one. left/top stay at 0 to
	 * match what resolveLaneAt already assumes about `contentY`.
	 */
	function stubViewportRect() {
		const vp = screen.getByTestId("scheduler-viewport");
		vp.getBoundingClientRect = () =>
			({
				left: 0,
				top: 0,
				right: 800,
				bottom: 400,
				width: 800,
				height: 400,
				x: 0,
				y: 0,
				toJSON: () => {},
			}) as DOMRect;
		return vp;
	}

	function unplannedRow(id: string) {
		const panel = screen.getByTestId("scheduler-unplanned-panel");
		return within(panel)
			.getAllByTestId("unplanned-task")
			.find((el) => el.getAttribute("data-task-id") === id) as HTMLElement;
	}

	it("dragging a panel task onto a lane schedules it for that assignee", () => {
		const scheduleTask = vi.fn();
		renderWithUndated({ projectId: "proj-1", scheduleTask });
		stubViewportRect();

		const row = unplannedRow("u-1");
		fireEvent.pointerDown(row, { clientX: 700, clientY: 50, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 300, clientY: 50 });

		// A live preview and lane ring confirm the drop target before release.
		expect(screen.getByTestId("scheduler-drop-preview")).toBeTruthy();
		expect(screen.getByTestId("scheduler-drop-lane")).toBeTruthy();

		fireEvent.pointerUp(window, { clientX: 300, clientY: 50 });

		expect(scheduleTask).toHaveBeenCalledTimes(1);
		const [taskId, startDate, endDate, assigneeId] = scheduleTask.mock.calls[0];
		expect(taskId).toBe("u-1");
		// A drop lands on the single day under the pointer.
		expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(endDate).toBe(startDate);
		// clientY 50 falls in the first row, which sorts alphabetically to Ana.
		expect(assigneeId).toBe("u_ana");

		// The preview clears on release.
		expect(screen.queryByTestId("scheduler-drop-preview")).toBeNull();
	});

	it("releasing outside the lanes viewport cancels the drop", () => {
		const scheduleTask = vi.fn();
		renderWithUndated({ projectId: "proj-1", scheduleTask });
		stubViewportRect();

		const row = unplannedRow("u-2");
		fireEvent.pointerDown(row, { clientX: 700, clientY: 50, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 300, clientY: 50 });
		expect(screen.getByTestId("scheduler-drop-preview")).toBeTruthy();

		// Back over the panel (x past the viewport's right edge): no preview, no commit.
		fireEvent.pointerMove(window, { clientX: 900, clientY: 50 });
		expect(screen.queryByTestId("scheduler-drop-preview")).toBeNull();
		fireEvent.pointerUp(window, { clientX: 900, clientY: 50 });

		expect(scheduleTask).not.toHaveBeenCalled();
	});

	it("releasing over the panel cancels, even though it overlays the viewport", () => {
		const scheduleTask = vi.fn();
		renderWithUndated({ projectId: "proj-1", scheduleTask });
		stubViewportRect();
		// The panel floats over the viewport's right edge, so x=600 is inside the
		// viewport rect *and* over the panel.
		const panel = screen.getByTestId("scheduler-unplanned-panel");
		panel.getBoundingClientRect = () =>
			({
				left: 460,
				top: 0,
				right: 800,
				bottom: 400,
				width: 340,
				height: 400,
				x: 460,
				y: 0,
				toJSON: () => {},
			}) as DOMRect;

		const row = unplannedRow("u-1");
		fireEvent.pointerDown(row, { clientX: 600, clientY: 50, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 300, clientY: 50 });
		expect(screen.getByTestId("scheduler-drop-preview")).toBeTruthy();

		fireEvent.pointerMove(window, { clientX: 600, clientY: 50 });
		expect(screen.queryByTestId("scheduler-drop-preview")).toBeNull();
		fireEvent.pointerUp(window, { clientX: 600, clientY: 50 });

		expect(scheduleTask).not.toHaveBeenCalled();
	});

	it("a click with no movement does not schedule the task", () => {
		const scheduleTask = vi.fn();
		renderWithUndated({ projectId: "proj-1", scheduleTask });
		stubViewportRect();

		const row = unplannedRow("u-1");
		fireEvent.pointerDown(row, { clientX: 700, clientY: 50, pointerId: 1 });
		fireEvent.pointerUp(window, { clientX: 700, clientY: 50 });

		expect(scheduleTask).not.toHaveBeenCalled();
	});

	it("the toolbar button hides and re-shows the panel", () => {
		renderWithUndated();
		const toggle = screen.getByLabelText("Toggle unplanned tasks");

		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByTestId("scheduler-unplanned-panel")).toBeTruthy();

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		expect(screen.queryByTestId("scheduler-unplanned-panel")).toBeNull();

		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByTestId("scheduler-unplanned-panel")).toBeTruthy();
	});
});
