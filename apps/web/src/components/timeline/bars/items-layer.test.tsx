// apps/web/src/components/timeline/bars/items-layer.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { TimelineProvider, useTimelineController } from "../controller/context";
import { TimelineDataProvider, useTimelineData } from "../data/context";
import TimelineTable from "../layout/timeline-table";
import { RowSelectionProvider } from "../selection/context";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";
import ItemsLayer from "./items-layer";

vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

// Fixture mirroring the shape of the former timeline-items mock seed: a mix
// of parent/child tasks and milestones spanning several months, used so
// geometry-dependent assertions (row count/height, narrow-bar labels,
// off-screen fly-outs) keep exercising realistic data.
const seedItems: TimelineItem[] = [
	{
		id: "ms-kickoff",
		kind: "milestone",
		name: "Kickoff",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-01",
		color: "#0ea5e9",
	},
	{
		id: "p-platform",
		kind: "task",
		name: "Core Platform",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-09-18",
		color: "#6366f1",
	},
	{
		id: "t-design",
		kind: "task",
		name: "Design system foundations",
		parentId: "p-platform",
		startDate: "2026-06-15",
		endDate: "2026-06-30",
		progress: 65,
		color: "#ec4899",
	},
	{
		id: "t-api",
		kind: "task",
		name: "API schema & data model",
		parentId: "p-platform",
		startDate: "2026-06-22",
		endDate: "2026-07-10",
		progress: 40,
		color: "#f59e0b",
	},
	{
		id: "t-axis",
		kind: "task",
		name: "Timeline calendar axis",
		parentId: "p-platform",
		startDate: "2026-06-26",
		endDate: "2026-07-17",
		progress: 25,
		color: "#10b981",
	},
	{
		id: "t-auth",
		kind: "task",
		name: "Authentication & onboarding",
		parentId: "p-platform",
		startDate: "2026-07-13",
		endDate: "2026-07-31",
		progress: 0,
		color: "#3b82f6",
	},
	{
		id: "ms-beta",
		kind: "milestone",
		name: "Beta launch",
		parentId: "p-platform",
		startDate: "2026-09-14",
		endDate: "2026-09-14",
		color: "#0ea5e9",
	},
	{
		id: "p-billing",
		kind: "task",
		name: "Billing & Payments",
		parentId: null,
		startDate: "2026-07-20",
		endDate: "2026-09-30",
		color: "#ef4444",
	},
	{
		id: "t-billing",
		kind: "task",
		name: "Billing integration",
		parentId: "p-billing",
		startDate: "2026-07-20",
		endDate: "2026-08-14",
		progress: 0,
		color: "#ef4444",
	},
	{
		id: "t-invoicing",
		kind: "task",
		name: "Invoicing & receipts",
		parentId: "p-billing",
		startDate: "2026-08-10",
		endDate: "2026-09-05",
		progress: 0,
		color: "#f97316",
	},
	{
		id: "p-mobile",
		kind: "task",
		name: "Mobile App",
		parentId: null,
		startDate: "2026-08-01",
		endDate: "2026-11-15",
		color: "#14b8a6",
	},
	{
		id: "t-ios-shell",
		kind: "task",
		name: "iOS app shell",
		parentId: "p-mobile",
		startDate: "2026-08-03",
		endDate: "2026-08-28",
		progress: 0,
		color: "#14b8a6",
	},
	{
		id: "t-android-shell",
		kind: "task",
		name: "Android app shell",
		parentId: "p-mobile",
		startDate: "2026-08-17",
		endDate: "2026-09-11",
		progress: 0,
		color: "#0d9488",
	},
	{
		id: "t-offline-sync",
		kind: "task",
		name: "Offline sync engine",
		parentId: "p-mobile",
		startDate: "2026-09-07",
		endDate: "2026-10-09",
		progress: 0,
		color: "#06b6d4",
	},
	{
		id: "t-push",
		kind: "task",
		name: "Push notifications",
		parentId: "p-mobile",
		startDate: "2026-10-05",
		endDate: "2026-10-30",
		progress: 0,
		color: "#0891b2",
	},
	{
		id: "ms-mobile-launch",
		kind: "milestone",
		name: "Mobile launch",
		parentId: "p-mobile",
		startDate: "2026-11-13",
		endDate: "2026-11-13",
		color: "#0ea5e9",
	},
	{
		id: "p-growth",
		kind: "task",
		name: "Growth & Marketing",
		parentId: null,
		startDate: "2026-09-01",
		endDate: "2026-12-01",
		color: "#f59e0b",
	},
	{
		id: "t-landing",
		kind: "task",
		name: "Landing pages",
		parentId: "p-growth",
		startDate: "2026-09-01",
		endDate: "2026-09-25",
		progress: 0,
		color: "#f59e0b",
	},
	{
		id: "t-seo",
		kind: "task",
		name: "SEO & content",
		parentId: "p-growth",
		startDate: "2026-09-21",
		endDate: "2026-10-23",
		progress: 0,
		color: "#eab308",
	},
	{
		id: "t-funnel",
		kind: "task",
		name: "Onboarding funnel",
		parentId: "p-growth",
		startDate: "2026-10-19",
		endDate: "2026-11-13",
		progress: 0,
		color: "#d97706",
	},
	{
		id: "t-analytics",
		kind: "task",
		name: "Analytics instrumentation",
		parentId: "p-growth",
		startDate: "2026-11-09",
		endDate: "2026-12-01",
		progress: 0,
		color: "#ca8a04",
	},
	{
		id: "p-infra",
		kind: "task",
		name: "Infrastructure & Reliability",
		parentId: null,
		startDate: "2026-06-15",
		endDate: "2026-10-15",
		color: "#8b5cf6",
	},
	{
		id: "t-cicd",
		kind: "task",
		name: "CI/CD pipeline",
		parentId: "p-infra",
		startDate: "2026-06-15",
		endDate: "2026-07-10",
		progress: 80,
		color: "#8b5cf6",
	},
	{
		id: "t-observability",
		kind: "task",
		name: "Observability & alerting",
		parentId: "p-infra",
		startDate: "2026-07-13",
		endDate: "2026-08-21",
		progress: 10,
		color: "#a855f7",
	},
	{
		id: "t-loadtest",
		kind: "task",
		name: "Load & soak testing",
		parentId: "p-infra",
		startDate: "2026-09-01",
		endDate: "2026-10-15",
		progress: 0,
		color: "#9333ea",
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
		createTask: vi.fn(() => Promise.resolve({ id: "new-task" })),
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

beforeEach(() => {
	vi.mocked(useTimelineData).mockReturnValue(defaultTimelineData());
});

function makeQc() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

/**
 * Bridges the mocked `useTimelineData` to real React state so drag/resize
 * gestures (which call `moveDays`/`updateItem`) actually re-render with
 * updated positions, mirroring TimelineDataProvider's real local-state logic.
 */
function shiftDates(item: TimelineItem, days: number): TimelineItem {
	const move = (iso: string) =>
		toUtcDateString(startOfUtcDay(Date.parse(iso)) + days * ONE_DAY);
	return {
		...item,
		startDate: move(item.startDate),
		endDate: move(item.endDate),
	};
}

function SeedDataBridge({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<TimelineItem[]>(seedItems);
	vi.mocked(useTimelineData).mockReturnValue(
		defaultTimelineData({
			items,
			// Mirrors TimelineDataProvider's real moveDays: dragging a parent with
			// children re-dates its leaf descendants (not the parent's own,
			// display-only placeholder dates), matching the container-rect logic
			// in controller/layout.ts (a parent's rendered range comes from its
			// children, not its own dates).
			moveDays: (id, days) => {
				if (days === 0) return;
				setItems((prev) => {
					const hasChildren = prev.some((i) => i.parentId === id);
					if (!hasChildren) {
						return prev.map((i) => (i.id === id ? shiftDates(i, days) : i));
					}
					const descendants = new Set<string>();
					let added = true;
					while (added) {
						added = false;
						for (const i of prev) {
							if (
								i.parentId &&
								(i.parentId === id || descendants.has(i.parentId)) &&
								!descendants.has(i.id)
							) {
								descendants.add(i.id);
								added = true;
							}
						}
					}
					return prev.map((i) =>
						descendants.has(i.id) && !prev.some((c) => c.parentId === i.id)
							? shiftDates(i, days)
							: i,
					);
				});
			},
			updateItem: (id, patch) =>
				setItems((prev) =>
					prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
				),
		}),
	);
	return <>{children}</>;
}

function renderLayer(
	width = 100000,
	zoom: "weeks" | "months" | "quarters" = "weeks",
) {
	// huge width so the whole seed span is on-screen (no fly-outs)
	return render(
		<QueryClientProvider client={makeQc()}>
			<TimelineDataProvider>
				<SeedDataBridge>
					<TimelineProvider initialZoom={zoom}>
						<SizeViewport width={width} />
						<ItemsLayer />
					</TimelineProvider>
				</SeedDataBridge>
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
		// quarters zoom (3.6px/day) makes the seed bars narrow relative to their
		// long names, so the label spills outside.
		const { container } = renderLayer(640, "quarters");
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
		vi.mocked(useTimelineData).mockReturnValue(
			defaultTimelineData({ items: [], ...overrides }),
		);
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
	// The file-level `beforeEach` above resets the mock to `defaultTimelineData()`
	// (seed items) before every test, including these, so renderLayer() renders
	// leaf-task nodes regardless of what the `state overlays` suite set last.

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
