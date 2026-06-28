import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RowSelectionProvider, useRowSelection } from "./context";

const IDS = ["a", "b", "c", "d"];
const wrapper = ({ children }: { children: ReactNode }) => (
	<RowSelectionProvider>{children}</RowSelectionProvider>
);

describe("useRowSelection", () => {
	it("selectOne replaces the selection and sets the anchor", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectOne("b"));
		expect([...result.current.selectedIds]).toEqual(["b"]);
		act(() => result.current.selectOne("c"));
		expect([...result.current.selectedIds]).toEqual(["c"]);
	});

	it("selectTo selects the inclusive range from the anchor", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectOne("b"));
		act(() => result.current.selectTo("d", IDS));
		expect([...result.current.selectedIds].sort()).toEqual(["b", "c", "d"]);
	});

	it("toggle adds then removes an id", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.toggle("a"));
		expect(result.current.isSelected("a")).toBe(true);
		act(() => result.current.toggle("a"));
		expect(result.current.isSelected("a")).toBe(false);
	});

	it("selectAll selects everything, then clears when all are selected", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectAll(IDS));
		expect(result.current.selectedIds.size).toBe(4);
		act(() => result.current.selectAll(IDS));
		expect(result.current.selectedIds.size).toBe(0);
	});

	it("clear empties the selection; setHovered tracks the hovered id", () => {
		const { result } = renderHook(() => useRowSelection(), { wrapper });
		act(() => result.current.selectOne("a"));
		act(() => result.current.clear());
		expect(result.current.selectedIds.size).toBe(0);
		act(() => result.current.setHovered("c"));
		expect(result.current.hoveredId).toBe("c");
	});
});
