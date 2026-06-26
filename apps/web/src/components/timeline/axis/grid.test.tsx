import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimelineGrid from "./grid";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

describe("TimelineGrid", () => {
	it("renders gridline cells once the viewport has a width", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<TimelineGrid />
			</TimelineProvider>,
		);
		const cells = container.querySelectorAll("[data-testid='timeline-grid-unit']");
		expect(cells.length).toBeGreaterThan(0);
	});

	it("highlights exactly one today column", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<TimelineGrid />
			</TimelineProvider>,
		);
		const highlighted = container.querySelectorAll("[data-today='true']");
		expect(highlighted.length).toBe(1);
	});
});
