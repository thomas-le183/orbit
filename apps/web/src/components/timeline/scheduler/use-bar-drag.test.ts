import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { startOfUtcDay } from "../units/make-units";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));

vi.mock("../controller/context", () => ({
	useTimelineController: () => ({ zoomLevel: "weeks", today: TODAY }),
}));
vi.mock("../bars/use-edge-autoscroll", () => ({
	useEdgeAutoScroll: () => ({
		start: vi.fn(),
		stop: vi.fn(),
		setPointer: vi.fn(),
	}),
}));

import { useBarDrag } from "./use-bar-drag";

const ONE_DAY = 86_400_000;
// weeks = 48 px/day.
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

		// +192px = +3 days at 64 px/day.
		act(() => {
			fireEvent.pointerMove(window, { clientX: 292, clientY: 0 });
		});
		expect(result.current.draft).toEqual({
			id: "t1",
			range: { from: 3 * ONE_DAY, to: 6 * ONE_DAY },
		});

		act(() => {
			fireEvent.pointerUp(window, { clientX: 292, clientY: 0 });
		});
		// range {3d, 6d} → start today+3, end today+6-1day.
		expect(onCommit).toHaveBeenCalledWith(
			"t1",
			{
				startDate: "2026-06-04",
				endDate: "2026-06-06",
			},
			null,
		);
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
		// +96px = +2 days at 48 px/day.
		act(() => {
			fireEvent.pointerUp(window, { clientX: 96, clientY: 0 });
		});
		// range {0, 5d} → start today, end today+5-1day.
		expect(onCommit).toHaveBeenCalledWith(
			"t1",
			{
				startDate: "2026-06-01",
				endDate: "2026-06-05",
			},
			null,
		);
	});

	it("resize-start moves only the start date", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t1",
				role: "resize-start",
				range,
			});
		});
		// +48px = +1 day.
		act(() => {
			fireEvent.pointerUp(window, { clientX: 48, clientY: 0 });
		});
		// range {1d, 3d} → start today+1, end today+3-1day.
		expect(onCommit).toHaveBeenCalledWith(
			"t1",
			{
				startDate: "2026-06-02",
				endDate: "2026-06-03",
			},
			null,
		);
	});

	it("does not commit a resize-start gesture that ends unchanged", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));
		act(() => {
			result.current.beginDrag(pointerDownEvent(0), {
				id: "t1",
				role: "resize-start",
				range,
			});
		});
		act(() => {
			fireEvent.pointerUp(window, { clientX: 0, clientY: 0 });
		});
		expect(onCommit).not.toHaveBeenCalled();
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
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("reports a drag for a straight-down move with no horizontal travel", () => {
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
			fireEvent.pointerMove(window, { clientX: 50, clientY: 150 });
		});
		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 150 });
		});
		expect(result.current.wasDragged()).toBe(true);
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

	it("exposes no pointer until the pointer actually moves", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));

		act(() => {
			result.current.beginDrag(pointerDownEvent(100), {
				id: "t1",
				role: "move",
				range,
			});
		});
		// `active` is set on pointerdown, but `pointer` waits for real movement.
		expect(result.current.active).toEqual({ id: "t1", role: "move" });
		expect(result.current.pointer).toBeNull();
	});

	it("exposes the pointer position during a drag and clears it on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useBarDrag({ onCommit }));

		act(() => {
			result.current.beginDrag(pointerDownEvent(100), {
				id: "t1",
				role: "move",
				range,
			});
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 148, clientY: 60 });
		});
		expect(result.current.pointer).toEqual({ x: 148, y: 60 });

		act(() => {
			fireEvent.pointerUp(window, { clientX: 148, clientY: 60 });
		});
		expect(result.current.pointer).toBeNull();
	});
});

describe("useBarDrag vertical lane tracking", () => {
	// clientY < 100 → lane "a" (contentY passthrough); >= 100 → lane "b".
	const resolveLaneAt = (clientY: number) => ({
		key: clientY < 100 ? "a" : "b",
		contentY: clientY,
	});

	it("tracks the target lane + pointer position during a move and commits the lane on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() =>
			useBarDrag({ onCommit, resolveLaneAt }),
		);

		act(() => {
			result.current.beginDrag(pointerDownEvent(50), {
				id: "t1",
				role: "move",
				range,
				laneKey: "a",
			});
		});
		// Move down into lane "b" at clientY 150 (also +? px right; keep X same here).
		act(() => {
			fireEvent.pointerMove(window, { clientX: 50, clientY: 150 });
		});
		expect(result.current.draft?.targetLaneKey).toBe("b");
		expect(result.current.draft?.pointerContentY).toBe(150);

		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 150 });
		});
		// Lane changed a→b, so onCommit's 3rd arg is "b" (dates unchanged: same start/end).
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit.mock.calls[0][0]).toBe("t1");
		expect(onCommit.mock.calls[0][2]).toBe("b");
	});

	it("does not commit a reassign when released in the origin lane with no move", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() =>
			useBarDrag({ onCommit, resolveLaneAt }),
		);
		act(() => {
			result.current.beginDrag(pointerDownEvent(50), {
				id: "t1",
				role: "move",
				range,
				laneKey: "a",
			});
		});
		// Stay in lane "a" (clientY 60), no horizontal move.
		act(() => {
			fireEvent.pointerUp(window, { clientX: 50, clientY: 60 });
		});
		expect(onCommit).not.toHaveBeenCalled();
	});
});
