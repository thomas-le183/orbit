import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { TimelineProvider } from "../controller/context";
import { TimelineDataProvider, useTimelineData } from "../data/context";
import { RowSelectionProvider } from "../selection/context";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

// Small fixture standing in for the removed timeline-items seed; enough rows
// (>= 3) to exercise multi-row selection assertions below.
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
	{
		id: "t-c",
		kind: "task",
		name: "Task C",
		parentId: null,
		startDate: "2026-06-20",
		endDate: "2026-06-24",
		color: "#6366f1",
	},
	{
		id: "t-d",
		kind: "task",
		name: "Task D",
		parentId: null,
		startDate: "2026-06-25",
		endDate: "2026-06-29",
		color: "#6366f1",
	},
];

function defaultTimelineData(
	overrides: Partial<ReturnType<typeof useTimelineData>> = {},
): ReturnType<typeof useTimelineData> {
	return {
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
		...overrides,
	};
}

function renderTable() {
	vi.mocked(useTimelineData).mockReturnValue(defaultTimelineData());
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<TimelineDataProvider>
				<TimelineProvider initialZoom="weeks">
					<RowSelectionProvider>
						<TimelineTableHeader />
						<TimelineTable />
					</RowSelectionProvider>
				</TimelineProvider>
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
}

describe("TimelineTable", () => {
	it("renders one row cell per timeline item row", () => {
		const { container } = renderTable();
		expect(
			container.querySelectorAll("[data-testid='timeline-table-row']").length,
		).toBeGreaterThan(0);
	});

	it("positions each row in its full-height lane (first row at the top)", () => {
		const { container } = renderTable();
		const first = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		expect(first?.style.top).toBe("0px");
		expect(first?.style.height).toBe("40px");
	});

	const rowCheckbox = (row: HTMLElement) =>
		row.querySelector<HTMLElement>("[data-slot='checkbox']") as HTMLElement;

	it("selects a row only via its checkbox", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rowCheckbox(rows[0]));
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("false");
	});

	it("does not change the selection when the row body is clicked", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rowCheckbox(rows[0]));
		await user.click(rows[1]); // clicking another row's body must NOT move selection
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("false");
	});

	it("shift-click on a checkbox selects a contiguous range", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rowCheckbox(rows[0]));
		await user.keyboard("{Shift>}");
		await user.click(rowCheckbox(rows[2]));
		await user.keyboard("{/Shift}");
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("true");
		expect(rows[2].getAttribute("data-selected")).toBe("true");
	});

	it("header checkbox selects all rows, then clears all", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const header = screen.getByTestId("timeline-select-all");
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(header);
		expect(
			[...rows].every((r) => r.getAttribute("data-selected") === "true"),
		).toBe(true);
		await user.click(header); // any selection → clear all immediately
		expect(
			[...rows].every((r) => r.getAttribute("data-selected") === "false"),
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

describe("TimelineTable unplanned indicator", () => {
	const datedItem: TimelineItem = {
		id: "t1",
		kind: "task",
		name: "Dated Task",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-05",
		color: "#6366f1",
	};

	function renderWithMock(
		overrides: Partial<ReturnType<typeof useTimelineData>>,
	) {
		const base: ReturnType<typeof useTimelineData> = {
			items: [],
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
			...overrides,
		};
		vi.mocked(useTimelineData).mockReturnValue(base);
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		return render(
			<QueryClientProvider client={qc}>
				<TimelineDataProvider>
					<TimelineProvider initialZoom="weeks">
						<RowSelectionProvider>
							<TimelineTable />
						</RowSelectionProvider>
					</TimelineProvider>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
	}

	afterEach(() => vi.mocked(useTimelineData).mockRestore());

	it("marks each undated row with an Unplanned indicator", () => {
		renderWithMock({
			items: [datedItem],
			undatedTaskRows: [{ id: "u1", name: "Undated Task", parentId: null }],
		});
		expect(screen.getAllByLabelText("Unplanned")).toHaveLength(1);
	});

	it("does not mark dated rows as unplanned", () => {
		renderWithMock({ items: [datedItem], undatedTaskRows: [] });
		expect(screen.queryByLabelText("Unplanned")).toBeNull();
	});
});
