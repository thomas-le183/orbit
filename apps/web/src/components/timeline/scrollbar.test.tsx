import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import TimelineScrollbar from "./scrollbar";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function OffsetReadout() {
	const { offsetMs } = useTimelineController();
	return <span data-testid="offset">{offsetMs}</span>;
}

describe("TimelineScrollbar", () => {
	it("renders a track and a thumb with a positive width once measured", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={800} />
				<TimelineScrollbar />
			</TimelineProvider>,
		);
		const track = container.querySelector(
			"[data-testid='timeline-scrollbar-track']",
		);
		const thumb = container.querySelector<HTMLElement>(
			"[data-testid='timeline-scrollbar-thumb']",
		);
		expect(track).not.toBeNull();
		expect(thumb).not.toBeNull();
		expect(
			Number.parseFloat((thumb as HTMLElement).style.width),
		).toBeGreaterThan(0);
	});

	it("pans the timeline when the empty track is clicked to the right of the thumb", () => {
		const { container, getByTestId } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={800} />
				<TimelineScrollbar />
				<OffsetReadout />
			</TimelineProvider>,
		);
		const before = Number(getByTestId("offset").textContent);
		const track = container.querySelector(
			"[data-testid='timeline-scrollbar-track']",
		);
		if (!track) throw new Error("track not found");
		// Click far to the right of the thumb → step forward in time (offset increases).
		fireEvent.mouseDown(track, { clientX: 100000 });
		const after = Number(getByTestId("offset").textContent);
		expect(after).toBeGreaterThan(before);
	});
});
