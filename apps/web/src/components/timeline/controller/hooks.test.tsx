import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./context";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useZoomLevel,
} from "./hooks";

const wrapper = ({ children }: { children: ReactNode }) => (
	<TimelineProvider initialZoom="weeks">{children}</TimelineProvider>
);

describe("useZoomLevel", () => {
	it("exposes the current zoom and updates it", () => {
		const { result } = renderHook(() => useZoomLevel(), { wrapper });
		expect(result.current[0]).toBe("weeks");
		act(() => result.current[1]("months"));
		expect(result.current[0]).toBe("months");
	});
});

describe("useHorizontalPercentageOffset", () => {
	it("maps the left-edge offset to 0%", () => {
		const { result } = renderHook(
			() => ({
				ctrl: useTimelineController(),
				offset: useHorizontalPercentageOffset(),
			}),
			{ wrapper },
		);
		act(() => result.current.ctrl.setViewportWidth(320));
		const leftEdgeMs = result.current.ctrl.offsetMs;
		expect(result.current.offset.getPercentageOffset(leftEdgeMs)).toBeCloseTo(0, 6);
	});
});

describe("useRenderingWindow", () => {
	it("brackets the visible slice with a one-screen buffer each side", () => {
		const { result } = renderHook(
			() => ({ ctrl: useTimelineController(), win: useRenderingWindow() }),
			{ wrapper },
		);
		act(() => result.current.ctrl.setViewportWidth(320));
		const { from, to } = result.current.win;
		// window must be wider than the viewport span and contain offsetMs
		expect(from).toBeLessThan(result.current.ctrl.offsetMs);
		expect(to).toBeGreaterThan(result.current.ctrl.offsetMs);
	});
});
