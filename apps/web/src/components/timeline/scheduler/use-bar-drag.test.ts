import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { startOfUtcDay } from "../units/make-units";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));

vi.mock("../controller/context", () => ({
	useTimelineController: () => ({ zoomLevel: "weeks", today: TODAY }),
}));
vi.mock("../bars/use-edge-autoscroll", () => ({
	useEdgeAutoScroll: () => ({ start: vi.fn(), stop: vi.fn(), setPointer: vi.fn() }),
}));

import { useBarDrag } from "./use-bar-drag";

const ONE_DAY = 86_400_000;
// weeks = 32 px/day.
function pointerDownEvent(clientX: number) {
	const target = {
		setPointerCapture: vi.fn(),
		releasePointerCapture: vi.fn(),
	};
	return {
		clientX,
		clientY: 0,
		pointerId: 1,
		currentTarget: target,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	} as unknown as React.PointerEvent;
}

// A 3-day task starting today: from 0, to 3 days (exclusive end).
const range = { from: 0, to: 3 * ONE_DAY };

describe("useBarDrag", () => {
	it("moves both dates by the snapped day delta on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));

		act(() => {
			result.current.beginDrag(pointerDownEvent(100), {
				id: "t1",
				role: "move",
				range,
			});
		});
		expect(result.current.active).toEqual({ id: "t1", role: "move" });

		// +96px = +3 days at 32 px/day.
		act(() => {
			fireEvent.pointerMove(window, { clientX: 196, clientY: 0 });
		});
		expect(result.current.draft).toEqual({
			id: "t1",
			range: { from: 3 * ONE_DAY, to: 6 * ONE_DAY },
		});

		act(() => {
			fireEvent.pointerUp(window, { clientX: 196, clientY: 0 });
		});
		// range {3d, 6d} → start today+3, end today+6-1day.
		expect(onCommit).toHaveBeenCalledWith("t1", {
			startDate: "2026-06-04",
			endDate: "2026-06-06",
		});
		expect(result.current.draft).toBeNull();
		expect(result.current.active).toBeNull();
		expect(result.current.wasDragged()).toBe(true);
	});

	it("resize-end moves only the end date", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t1",
				role: "resize-end",
				range,
			});
		});
		// +64px = +2 days.
		act(() => {
			fireEvent.pointerUp(window, { clientX: 64, clientY: 0 });
		});
		// range {0, 5d} → start today, end today+5-1day.
		expect(onCommit).toHaveBeenCalledWith("t1", {
			startDate: "2026-06-01",
			endDate: "2026-06-05",
		});
	});

	it("reports no drag for a stationary press (tap)", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(50), {
				id: "t1",
				role: "move",
				range,
			});
		});
		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 0 });
		});
		expect(result.current.wasDragged()).toBe(false);
	});

	it("ignores a second beginDrag while a gesture is active", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t1",
				role: "move",
				range,
			});
		});
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t2",
				role: "move",
				range,
			});
		});
		expect(result.current.active).toEqual({ id: "t1", role: "move" });
	});
});
