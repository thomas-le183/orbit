import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MAX_TABLE_WIDTH } from "./divider";
import { useResizableDivider } from "./use-resizable-divider";

// Minimal React.PointerEvent stand-in carrying the fields the hook reads.
function pointerDownAt(clientX: number) {
	return {
		clientX,
		preventDefault() {},
	} as unknown as React.PointerEvent;
}

describe("useResizableDivider", () => {
	it("starts at the initial width", () => {
		const { result } = renderHook(() => useResizableDivider(320));
		expect(result.current.tableWidth).toBe(320);
	});

	it("widens as the pointer moves right", () => {
		const { result } = renderHook(() => useResizableDivider(320));
		act(() => result.current.onDividerPointerDown(pointerDownAt(400)));
		act(() => {
			window.dispatchEvent(new MouseEvent("pointermove", { clientX: 460 }));
		});
		expect(result.current.tableWidth).toBe(380); // 320 + (460 - 400)
		act(() => window.dispatchEvent(new MouseEvent("pointerup")));
	});

	it("clamps at the maximum", () => {
		const { result } = renderHook(() => useResizableDivider(320));
		act(() => result.current.onDividerPointerDown(pointerDownAt(0)));
		act(() => {
			window.dispatchEvent(new MouseEvent("pointermove", { clientX: 5000 }));
		});
		expect(result.current.tableWidth).toBe(MAX_TABLE_WIDTH);
		act(() => window.dispatchEvent(new MouseEvent("pointerup")));
	});
});
