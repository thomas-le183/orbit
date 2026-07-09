import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "../controller/context";
import { DragRangeProvider, DragRangePublisher } from "../drag/context";
import { ONE_DAY } from "../units/make-units";
import TimeUnitsBar from "./time-units-bar";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderBar(initialZoom: "weeks" | "months" | "quarters" | "years") {
	return render(
		<TimelineProvider initialZoom={initialZoom}>
			<SizeViewport width={800} />
			<TimeUnitsBar />
		</TimelineProvider>,
	);
}

describe("TimeUnitsBar", () => {
	it("renders a top row and a bottom row", () => {
		const { container } = renderBar("weeks");
		expect(
			container.querySelector("[data-testid='timeline-header-top']"),
		).not.toBeNull();
		expect(
			container.querySelector("[data-testid='timeline-header-bottom']"),
		).not.toBeNull();
	});

	it("renders bottom cells for each zoom level without crashing", () => {
		for (const zoom of ["weeks", "months", "quarters", "years"] as const) {
			const { container } = renderBar(zoom);
			const cells = container.querySelectorAll(
				"[data-testid='timeline-header-cell']",
			);
			expect(cells.length).toBeGreaterThan(0);
		}
	});

	it("does not highlight any bottom cell when no drag is in progress", () => {
		const { container } = renderBar("weeks");
		expect(container.querySelectorAll("[data-highlighted='true']").length).toBe(
			0,
		);
	});

	it("highlights only the bottom cells overlapping the drag range", () => {
		// `today` is offset 0, so this range covers exactly days 0 and 1.
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={800} />
				<DragRangeProvider>
					<DragRangePublisher
						range={{ from: 0, to: 2 * ONE_DAY }}
						pointerX={400}
					/>
					<TimeUnitsBar />
				</DragRangeProvider>
			</TimelineProvider>,
		);
		const highlighted = container.querySelectorAll(
			"[data-testid='timeline-header-cell'][data-highlighted='true']",
		);
		expect(highlighted.length).toBe(2);
		// Day-resolution zoom tints cells, so no pinned axis label.
		expect(
			container.querySelector("[data-testid='timeline-drag-axis-label']"),
		).toBeNull();
	});

	it("pins a date-range axis label instead of tinting cells at coarse zooms", () => {
		const { container } = render(
			<TimelineProvider initialZoom="quarters">
				<SizeViewport width={800} />
				<DragRangeProvider>
					<DragRangePublisher
						range={{ from: 0, to: 2 * ONE_DAY }}
						pointerX={400}
					/>
					<TimeUnitsBar />
				</DragRangeProvider>
			</TimelineProvider>,
		);
		// Coarse cells (quarters) are not tinted...
		expect(
			container.querySelectorAll(
				"[data-testid='timeline-header-cell'][data-highlighted='true']",
			).length,
		).toBe(0);
		// ...a date-range label is pinned to the axis instead.
		expect(
			container.querySelector("[data-testid='timeline-drag-axis-label']"),
		).not.toBeNull();
	});
});
