// apps/web/src/components/timeline/items-layer.test.tsx
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import ItemsLayer from "./items-layer";
import TimelineTable from "./layout/timeline-table";
import { RowSelectionProvider } from "./selection/context";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderLayer(width = 100000, zoom: "weeks" | "months" = "weeks") {
	// huge width so the whole seed span is on-screen (no fly-outs)
	return render(
		<TimelineProvider initialZoom={zoom}>
			<SizeViewport width={width} />
			<ItemsLayer />
		</TimelineProvider>,
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
			<TimelineProvider initialZoom="weeks">
				<RowSelectionProvider>
					<SizeViewport width={800} />
					<TimelineTable />
					<ItemsLayer />
				</RowSelectionProvider>
			</TimelineProvider>,
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
			<TimelineProvider initialZoom="weeks">
				<RowSelectionProvider>
					<SizeViewport width={800} />
					<ItemsLayer />
				</RowSelectionProvider>
			</TimelineProvider>,
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
