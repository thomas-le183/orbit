import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { TimelineDataProvider, useTimelineData } from "../data/context";
import SchedulerView from "./scheduler-view";

vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

// Fixture standing in for the removed timeline-items seed. Groups sort
// alphabetically by assignee name (see group-rows.ts), and only bars whose
// dates overlap the (today-centered) visible viewport are rendered — so every
// task here is dated close to "today" (2026-07-07 in this environment) at the
// default "weeks" zoom (~17 visible days). "Ana Alpha" has two tasks so that
// dragging its first (and, being alphabetically first, DOM-first) bar into
// the last lane leaves a distinguishable non-zero count behind.
const seedItems: TimelineItem[] = [
	{
		id: "t-ana-1",
		kind: "task",
		name: "Ana task one",
		parentId: null,
		startDate: "2026-07-01",
		endDate: "2026-07-03",
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
		startDate: "2026-07-04",
		endDate: "2026-07-05",
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
		startDate: "2026-07-06",
		endDate: "2026-07-08",
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
		startDate: "2026-07-09",
		endDate: "2026-07-11",
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
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		undatedTaskRows: [],
		scheduleTask: vi.fn(),
		reassignTask: vi.fn(),
		setEstimate: vi.fn(),
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

describe("SchedulerView", () => {
	it("renders per-assignee group headers from seed data", async () => {
		renderScheduler();
		const headers = await screen.findAllByTestId("scheduler-group-header");
		expect(headers.length).toBeGreaterThan(0);
		// Seed data assigns tasks to named users.
		expect(screen.getByText("Maya Chen")).toBeInTheDocument();
	});

	it("drag on a bar's resize handle sets its height to the clamped max", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		// Task bars carry a resize handle; milestones do not.
		const handles = screen.getAllByTestId("scheduler-bar-resize");
		expect(handles.length).toBeGreaterThan(0);
		const handle = handles[0];
		const bar = handle.closest("[data-testid='scheduler-bar']") as HTMLElement;

		// Drag far downward: any startHeight + large dy clamps to MAX (96px → 480min).
		fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientY: 400 });
		fireEvent.pointerUp(window, { clientY: 400 });

		expect(bar.style.height).toBe("96px");
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
});
