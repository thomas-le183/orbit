// apps/web/src/components/timeline/items-layer.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import { TimelineDataProvider, useTimelineData } from "./data/context";
import ItemsLayer from "./items-layer";
import TimelineTable from "./layout/timeline-table";
import { RowSelectionProvider } from "./selection/context";

vi.mock("./data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./data/context")>();
	return { ...actual, useTimelineData: vi.fn(actual.useTimelineData) };
});

function makeQc() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderLayer(width = 100000, zoom: "weeks" | "months" = "weeks") {
	// huge width so the whole seed span is on-screen (no fly-outs)
	return render(
		<QueryClientProvider client={makeQc()}>
			<TimelineDataProvider>
				<TimelineProvider initialZoom={zoom}>
					<SizeViewport width={width} />
					<ItemsLayer />
				</TimelineProvider>
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
}

describe("ItemsLayer", () => {
	it("renders parent containers, task bars, and milestone markers", () => {
		const { container } = renderLayer();
		expect(
			container.querySelectorAll("[data-testid='timeline-container-rect']")
				.length,
		).toBeGreaterThan(0);
		expect(
			container.querySelectorAll("[data-testid='timeline-task-bar']").length,
		).toBeGreaterThan(0);
		expect(
			container.querySelectorAll("[data-testid='timeline-milestone']").length,
		).toBeGreaterThan(0);
	});

	it("shows a fly-out for off-screen items in a narrow viewport", () => {
		const { container } = renderLayer(320);
		expect(
			container.querySelectorAll("[data-testid^='timeline-item-flyout-']")
				.length,
		).toBeGreaterThan(0);
	});

	it("moves a task bar's position after a drag gesture", () => {
		const { container } = renderLayer();
		const bar = container.querySelector(
			"[data-testid='timeline-task-bar']",
		) as HTMLElement;
		const before = bar.style.left;
		fireEvent.pointerDown(bar, { clientX: 0, pointerId: 1 });
		fireEvent.pointerMove(window, { clientX: 320, pointerId: 1 }); // 10 days @ weeks
		fireEvent.pointerUp(window, { clientX: 320, pointerId: 1 });
		const after = (
			container.querySelector(
				"[data-testid='timeline-task-bar']",
			) as HTMLElement
		).style.left;
		expect(after).not.toBe(before);
	});

	it("sizes the content to the stacked rows so it can scroll vertically", () => {
		const { container } = renderLayer();
		const content = container.querySelector(
			"[data-testid='timeline-items-content']",
		) as HTMLElement;
		const rowCount = container.querySelectorAll(
			"[data-testid='timeline-task-bar'], [data-testid='timeline-milestone']",
		).length;
		const height = Number.parseInt(content.style.height, 10);
		// height grows with rows (40px each) → tall enough to overflow a viewport
		expect(height).toBeGreaterThan(rowCount * 39);
		expect(height).toBeGreaterThan(600);
	});

	it("renders a label beside each visible milestone", () => {
		const { container } = renderLayer();
		const milestones = container.querySelectorAll(
			"[data-testid='timeline-milestone']",
		);
		const labels = container.querySelectorAll(
			"[data-testid='timeline-milestone-label']",
		);
		expect(milestones.length).toBeGreaterThan(0);
		expect(labels.length).toBe(milestones.length);
	});

	it("renders an outside label when a bar is too narrow for its name", () => {
		// months zoom (8px/day) in a 640px viewport makes the seed bars narrow
		// relative to their long names, so the label spills outside.
		const { container } = renderLayer(640, "months");
		const outside = container.querySelectorAll(
			"[data-testid='timeline-task-label-outside']",
		);
		expect(outside.length).toBeGreaterThan(0);
	});

	it("keeps the label inside when the bar is wide enough", () => {
		// huge viewport → bars far wider than their names → no outside labels.
		const { container } = renderLayer();
		expect(
			container.querySelectorAll("[data-testid='timeline-task-label-outside']")
				.length,
		).toBe(0);
	});

	it("shows a date tooltip that follows the cursor and hides on release", () => {
		const { container } = renderLayer();
		const handle = container.querySelector(
			"[data-testid='timeline-resize-end']",
		) as HTMLElement;
		fireEvent.pointerDown(handle, { clientX: 0, clientY: 200, pointerId: 5 });
		fireEvent.pointerMove(window, { clientX: 160, clientY: 220, pointerId: 5 });
		const tip = container.querySelector(
			"[data-testid='timeline-drag-tooltip']",
		) as HTMLElement;
		expect(tip).not.toBeNull();
		expect(tip.textContent?.trim().length).toBeGreaterThan(0);
		// positioned at the cursor (viewport coords)
		expect(tip.style.left).toBe("160px");
		expect(tip.style.top).toBe("208px"); // clientY (220) - 12px offset
		fireEvent.pointerUp(window, { clientX: 160, clientY: 220, pointerId: 5 });
		expect(
			container.querySelector("[data-testid='timeline-drag-tooltip']"),
		).toBeNull();
	});

	it("resizes the end edge via its handle", () => {
		const { container } = renderLayer();
		const handle = container.querySelector(
			"[data-testid='timeline-resize-end']",
		) as HTMLElement;
		const bar = handle.closest(
			"[data-testid='timeline-task-bar']",
		) as HTMLElement;
		const widthBefore = bar.style.width;
		fireEvent.pointerDown(handle, { clientX: 0, pointerId: 2 });
		fireEvent.pointerMove(window, { clientX: 160, pointerId: 2 }); // +5 days
		fireEvent.pointerUp(window, { clientX: 160, pointerId: 2 });
		const widthAfter = (
			container.querySelector(
				"[data-testid='timeline-task-bar']",
			) as HTMLElement
		).style.width;
		expect(widthAfter).not.toBe(widthBefore);
	});
});

describe("ItemsLayer row lanes", () => {
	const selectedLaneCount = (container: HTMLElement) =>
		[...container.querySelectorAll("[data-testid='timeline-row-lane']")].filter(
			(l) => l.getAttribute("data-selected") === "true",
		).length;

	it("highlights exactly one lane after a table row is selected", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<QueryClientProvider client={makeQc()}>
				<TimelineDataProvider>
					<TimelineProvider initialZoom="weeks">
						<RowSelectionProvider>
							<SizeViewport width={800} />
							<TimelineTable />
							<ItemsLayer />
						</RowSelectionProvider>
					</TimelineProvider>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		expect(selectedLaneCount(container)).toBe(0);
		const firstCheckbox = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row'] [data-slot='checkbox']",
		);
		if (!firstCheckbox) throw new Error("no row checkbox");
		await user.click(firstCheckbox);
		expect(selectedLaneCount(container)).toBe(1);
	});

	it("applies a hover background when a timeline lane is hovered", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<QueryClientProvider client={makeQc()}>
				<TimelineDataProvider>
					<TimelineProvider initialZoom="weeks">
						<RowSelectionProvider>
							<SizeViewport width={800} />
							<ItemsLayer />
						</RowSelectionProvider>
					</TimelineProvider>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		const lane = container.querySelector<HTMLElement>(
			"[data-testid='timeline-row-lane']",
		);
		if (!lane) throw new Error("no lane");
		await user.hover(lane);
		expect(lane.className).toContain("bg-muted/50");
		await user.unhover(lane);
		expect(lane.className).not.toContain("bg-muted/50");
	});
});

describe("ItemsLayer state overlays", () => {
	function renderWithMock(
		overrides: Partial<ReturnType<typeof useTimelineData>>,
	) {
		const base: ReturnType<typeof useTimelineData> = {
			items: [],
			updateItem: vi.fn(),
			moveDays: vi.fn(),
			undatedTaskRows: [],
			scheduleTask: vi.fn(),
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
		return render(
			<QueryClientProvider client={makeQc()}>
				<TimelineDataProvider>
					<TimelineProvider initialZoom="weeks">
						<RowSelectionProvider>
							<SizeViewport width={100000} />
							<ItemsLayer />
						</RowSelectionProvider>
					</TimelineProvider>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
	}

	it("shows the error overlay when isError is true", () => {
		const { container } = renderWithMock({ isError: true });
		expect(
			container.querySelector("[data-testid='timeline-items-error']"),
		).not.toBeNull();
	});

	it("renders a clickable lane for each undated task row", () => {
		const { container } = renderWithMock({
			undatedTaskRows: [{ id: "u1", name: "Undated Task", parentId: null }],
		});
		const lanes = container.querySelectorAll(
			"[data-testid='timeline-undated-lane']",
		);
		expect(lanes.length).toBe(1);
	});

	it("shows a ghost preview bar while hovering an undated lane", () => {
		const { container } = renderWithMock({
			undatedTaskRows: [{ id: "u1", name: "Undated Task", parentId: null }],
		});
		const lane = container.querySelector(
			"[data-testid='timeline-undated-lane']",
		) as HTMLElement;
		lane.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;
		expect(
			container.querySelector("[data-testid='timeline-undated-preview']"),
		).toBeNull();
		fireEvent.mouseMove(lane, { clientX: 200 });
		expect(
			container.querySelector("[data-testid='timeline-undated-preview']"),
		).not.toBeNull();
	});

	it("schedules an undated task when its lane is clicked", () => {
		const scheduleTask = vi.fn();
		const { container } = renderWithMock({
			undatedTaskRows: [{ id: "u1", name: "Undated Task", parentId: null }],
			scheduleTask,
		});
		const lane = container.querySelector(
			"[data-testid='timeline-undated-lane']",
		) as HTMLElement;
		// jsdom reports a zero-size rect; stub a real width so the click maps to a date.
		lane.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;
		fireEvent.click(lane, { clientX: 200 });
		expect(scheduleTask).toHaveBeenCalledTimes(1);
		const [id, startDate, endDate] = scheduleTask.mock.calls[0];
		expect(id).toBe("u1");
		// 7-day inclusive span → end is 6 days after start
		expect(Date.parse(endDate) - Date.parse(startDate)).toBe(6 * 86_400_000);
	});

	it("extends content height to include undated task rows", () => {
		const datedRows = [
			{
				kind: "task" as const,
				id: "t1",
				name: "Dated",
				parentId: null,
				startDate: "2024-01-01",
				endDate: "2024-01-07",
				progress: 0,
				color: "#000",
			},
		];
		const { container: c1 } = renderWithMock({
			items: datedRows,
			undatedTaskRows: [],
		});
		const { container: c2 } = renderWithMock({
			items: datedRows,
			undatedTaskRows: [{ id: "u1", name: "Undated", parentId: null }],
		});
		const h1 = (
			c1.querySelector("[data-testid='timeline-items-content']") as HTMLElement
		)?.style.height;
		const h2 = (
			c2.querySelector("[data-testid='timeline-items-content']") as HTMLElement
		)?.style.height;
		expect(h1).not.toBe(h2);
	});

	it("does not render the unscheduled count note", () => {
		const { container } = renderWithMock({ undatedTaskRows: [] });
		expect(
			container.querySelector("[data-testid='timeline-items-unscheduled']"),
		).toBeNull();
	});
});

describe("ItemsLayer connection nodes and dependency layer", () => {
	// The `ItemsLayer state overlays` suite above calls vi.mocked(useTimelineData).mockReturnValue(...)
	// without restoring afterwards. Reset to the original implementation before each test here so
	// renderLayer() gets the real seed data (and renders leaf-task nodes).
	beforeEach(() => {
		vi.mocked(useTimelineData).mockRestore();
	});

	it("hides connection nodes until a bar is hovered", async () => {
		const user = userEvent.setup();
		const { container } = renderLayer();
		const nodes = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-link-node']",
		);
		// Nodes exist in the DOM but are hidden (opacity-0) until hover.
		expect(nodes.length).toBeGreaterThan(0);
		expect(nodes[0].className).toContain("opacity-0");

		const bar = container.querySelector<HTMLElement>(
			"[data-testid='timeline-task-bar']",
		);
		if (bar) {
			await user.hover(bar);
		}
	});

	it("mounts the dependency layer", () => {
		const { container } = renderLayer();
		expect(
			container.querySelector("[data-testid='dependency-layer']"),
		).not.toBeNull();
	});
});
