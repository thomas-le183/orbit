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
		const cells = container.querySelectorAll(
			"[data-testid='timeline-grid-unit']",
		);
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

	it("renders months zoom with borders on month boundaries", () => {
		const { container } = render(
			<TimelineProvider initialZoom="months">
				<SizeViewport width={640} />
				<TimelineGrid />
			</TimelineProvider>,
		);
		const cells = container.querySelectorAll(
			"[data-testid='timeline-grid-unit']",
		);
		expect(cells.length).toBeGreaterThan(0);

		const borderCells = Array.from(cells).filter((cell) =>
			cell.className.includes("border-l"),
		);
		// Borders should be applied (at least one cell has a month boundary)
		expect(borderCells.length).toBeGreaterThan(0);
	});
});
