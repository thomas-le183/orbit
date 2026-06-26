import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import NowLine from "./now-line";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

describe("NowLine", () => {
	it("renders the now marker positioned at today (≈50% when centered)", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<NowLine />
			</TimelineProvider>,
		);
		const line = container.querySelector("[data-testid='timeline-now-line']");
		expect(line).not.toBeNull();
		const left = Number.parseFloat((line as HTMLElement).style.left);
		// today is centered on first measurement → near 50%
		expect(left).toBeGreaterThan(40);
		expect(left).toBeLessThan(60);
	});
});
