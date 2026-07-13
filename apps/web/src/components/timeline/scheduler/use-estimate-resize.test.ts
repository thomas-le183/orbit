import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEstimateResize } from "./use-estimate-resize";

/** Minimal ReactPointerEvent stand-in for beginResize. */
function pointerDownEvent(clientY: number) {
	const target = {
		setPointerCapture: vi.fn(),
		releasePointerCapture: vi.fn(),
	};
	return {
		clientY,
		pointerId: 1,
		currentTarget: target,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	} as unknown as React.PointerEvent;
}

describe("useEstimateResize", () => {
	it("tracks a draft during the drag and commits the snapped estimate on release", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useEstimateResize({ onCommit }));

		expect(result.current.draft).toBeNull();

		// Begin on a 24px bar for a single-day task at clientY 100.
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
				days: 1,
			});
		});
		expect(result.current.active).toBe("t1");

		// Move down 30px → 54px → 391 min/day → snaps to 390 (nearest 15).
		act(() => {
			fireEvent.pointerMove(window, { clientY: 130 });
		});
		expect(result.current.draft).toEqual({ id: "t1", estimatedTime: 390 });

		// Release commits and clears.
		act(() => {
			fireEvent.pointerUp(window, { clientY: 130 });
		});
		expect(onCommit).toHaveBeenCalledWith("t1", 390);
		expect(result.current.draft).toBeNull();
		expect(result.current.active).toBeNull();
	});

	it("multiplies the per-day effort by the day span for the total estimate", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useEstimateResize({ onCommit }));

		// Same drag as above (390 min/day) but on a 3-day task → 1170 total.
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
				days: 3,
			});
		});
		act(() => {
			fireEvent.pointerMove(window, { clientY: 130 });
		});
		expect(result.current.draft).toEqual({ id: "t1", estimatedTime: 1170 });
		act(() => {
			fireEvent.pointerUp(window, { clientY: 130 });
		});
		expect(onCommit).toHaveBeenCalledWith("t1", 1170);
	});

	it("ignores a second beginResize while a gesture is active", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useEstimateResize({ onCommit }));
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
				days: 1,
			});
		});
		act(() => {
			result.current.beginResize(pointerDownEvent(200), {
				id: "t2",
				startHeight: 96,
				days: 1,
			});
		});
		expect(result.current.active).toBe("t1");
	});
});
