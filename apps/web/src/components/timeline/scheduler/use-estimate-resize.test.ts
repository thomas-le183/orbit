import { act, renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
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

		// Begin on a 24px (min) bar at clientY 100.
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
			});
		});
		expect(result.current.active).toBe("t1");

		// Move down 36px → 60px → 300 min.
		act(() => {
			fireEvent.pointerMove(window, { clientY: 136 });
		});
		expect(result.current.draft).toEqual({ id: "t1", estimatedTime: 300 });

		// Release commits and clears.
		act(() => {
			fireEvent.pointerUp(window, { clientY: 136 });
		});
		expect(onCommit).toHaveBeenCalledWith("t1", 300);
		expect(result.current.draft).toBeNull();
		expect(result.current.active).toBeNull();
	});

	it("ignores a second beginResize while a gesture is active", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useEstimateResize({ onCommit }));
		act(() => {
			result.current.beginResize(pointerDownEvent(100), {
				id: "t1",
				startHeight: 24,
			});
		});
		act(() => {
			result.current.beginResize(pointerDownEvent(200), {
				id: "t2",
				startHeight: 96,
			});
		});
		expect(result.current.active).toBe("t1");
	});
});
