import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { tasks } from "@/data/tasks";
import { TimelineProvider, useTimelineController } from "./controller/context";
import TaskBars from "./task-bars";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderTimeline(width = 640) {
	return render(
		<TimelineProvider initialZoom="weeks">
			<SizeViewport width={width} />
			<TaskBars />
		</TimelineProvider>,
	);
}

describe("TaskBars", () => {
	it("represents every task as exactly one bar or fly-out", () => {
		const { container } = renderTimeline();
		const bars = container.querySelectorAll(
			"[data-testid='timeline-task-bar']",
		);
		const flyouts = container.querySelectorAll(
			"[data-testid^='timeline-task-flyout-']",
		);
		expect(bars.length + flyouts.length).toBe(tasks.length);
	});

	it("renders fly-out buttons for off-screen tasks", () => {
		// the task span (~3.5 months) far exceeds a 20-day weeks-zoom viewport,
		// so some tasks are always scrolled off-screen.
		const { container } = renderTimeline();
		const flyouts = container.querySelectorAll(
			"[data-testid^='timeline-task-flyout-']",
		);
		expect(flyouts.length).toBeGreaterThan(0);
	});

	it("pans the timeline when a fly-out is clicked", () => {
		let offset = Number.NaN;
		function ReadOffset() {
			offset = useTimelineController().offsetMs;
			return null;
		}
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<TaskBars />
				<ReadOffset />
			</TimelineProvider>,
		);

		const before = offset;
		const flyout = container.querySelector(
			"[data-testid^='timeline-task-flyout-']",
		);
		expect(flyout).not.toBeNull();
		fireEvent.click(flyout as HTMLElement);
		// clicking re-anchors the viewport, so the offset must change.
		expect(offset).not.toBe(before);
	});
});
