import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { TimelineDataProvider, useTimelineData } from "../data/context";
import SplitLayout from "./split-layout";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

// Small fixture standing in for the removed timeline-items seed.
const fixtureItems: TimelineItem[] = [
	{
		id: "t-a",
		kind: "task",
		name: "Task A",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-05",
		color: "#6366f1",
	},
	{
		id: "t-b",
		kind: "task",
		name: "Task B",
		parentId: null,
		startDate: "2026-06-10",
		endDate: "2026-06-14",
		color: "#6366f1",
	},
];

beforeEach(() => {
	vi.mocked(useTimelineData).mockReturnValue({
		items: fixtureItems,
		assignees: [],
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		undatedTaskRows: [],
		scheduleTask: vi.fn(),
		setEstimate: vi.fn(),
		milestoneMarkers: [],
		isLoading: false,
		isError: false,
		projectId: undefined,
		dependencies: [],
		createDependency: vi.fn(),
		deleteDependency: vi.fn(),
	});
});

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

function renderShell() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<TimelineDataProvider>
				<SplitLayout
					tableHeader={<TimelineTableHeader />}
					table={<TimelineTable />}
				/>
			</TimelineDataProvider>
		</QueryClientProvider>,
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

describe("SplitLayout toolbar: onNewTask", () => {
	it("renders a 'New task' button when onNewTask is provided", () => {
		const onNewTask = vi.fn();
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const { getByRole } = render(
			<QueryClientProvider client={client}>
				<TimelineDataProvider>
					<SplitLayout
						tableHeader={<TimelineTableHeader />}
						table={<TimelineTable />}
						onNewTask={onNewTask}
					/>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		const btn = getByRole("button", { name: /new task/i });
		expect(btn).toBeInTheDocument();
		fireEvent.click(btn);
		expect(onNewTask).toHaveBeenCalledOnce();
	});

	it("does not render a 'New task' button when onNewTask is not provided", () => {
		const { queryByRole } = renderShell();
		expect(queryByRole("button", { name: /new task/i })).toBeNull();
	});
});
