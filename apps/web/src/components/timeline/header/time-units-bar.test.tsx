import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "../controller/context";
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
});
