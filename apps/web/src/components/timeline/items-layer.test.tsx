// apps/web/src/components/timeline/items-layer.test.tsx
import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import ItemsLayer from "./items-layer";

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
