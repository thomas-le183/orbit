import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Geometry } from "../controller/geometry";
import { startOfUtcDay } from "../units/make-units";
import { useLaneCreate } from "./use-lane-create";

const geom: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 800 };
const today = startOfUtcDay(Date.UTC(2026, 6, 7)); // 2026-07-07

/** Minimal ReactPointerEvent stand-in over a lane rect of left=0 width=800. */
function pointerDownEvent(clientX: number) {
	return {
		clientX,
		pointerId: 1,
		currentTarget: {
			getBoundingClientRect: () => ({ left: 0, width: 800 }),
		},
		preventDefault: vi.fn(),
	} as unknown as React.PointerEvent;
}

describe("useLaneCreate", () => {
	it("creates a task with the dragged dates and the row's assignee on release", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-1" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), {
				key: "u_ana",
				assigneeId: "u_ana",
			});
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		// The ghost draft is live during the drag.
		expect(result.current.draft?.laneKey).toBe("u_ana");

		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});

		expect(onCreate).toHaveBeenCalledTimes(1);
		const arg = onCreate.mock.calls[0][0];
		expect(arg).toMatchObject({ name: "New task", assigneeId: "u_ana" });
		expect(typeof arg.startDate).toBe("string");
		expect(typeof arg.endDate).toBe("string");
		expect(arg.startDate <= arg.endDate).toBe(true);
		// After create resolves, that task enters rename mode.
		expect(result.current.renamingId).toBe("srv-1");
		expect(result.current.draft).toBeNull();
	});

	it("does not create on a click (no drag past threshold)", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-1" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(200), { key: "u_ana" });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 200 });
		});

		expect(onCreate).not.toHaveBeenCalled();
		expect(result.current.renamingId).toBeNull();
	});

	it("omits assigneeId when the row has none (Unassigned)", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-2" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "unassigned" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect("assigneeId" in onCreate.mock.calls[0][0]).toBe(false);
	});

	it("ignores a second beginCreate while a gesture is active", () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "x" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);
		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "a" });
		});
		act(() => {
			result.current.beginCreate(pointerDownEvent(500), { key: "b" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		expect(result.current.draft?.laneKey).toBe("a");
	});

	it("clearRenaming resets the rename target", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-3" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);
		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "a" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});
		expect(result.current.renamingId).toBe("srv-3");
		act(() => {
			result.current.clearRenaming();
		});
		expect(result.current.renamingId).toBeNull();
	});

	it("creates the true dragged span on a backtrack (never the default span)", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-4" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "u_ana" });
		});
		// Drag out past the threshold, then back to within 4px of the start.
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 101 });
		});
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 101 });
		});

		// moved is latched, so onCreate fires — with a 1-day dragged span, proving
		// it did NOT fall into draftRangeFromDrag's 7-day default-span branch.
		expect(onCreate).toHaveBeenCalledTimes(1);
		const arg = onCreate.mock.calls[0][0];
		expect(arg.startDate).toBe(arg.endDate);
	});
});
