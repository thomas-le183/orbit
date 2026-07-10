import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Geometry } from "../controller/geometry";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";

/** Captures the gesture's per-frame pan callback so tests can drive autoscroll. */
const autoScroll = {
	start: vi.fn(),
	stop: vi.fn(),
	setPointer: vi.fn(),
	onPan: null as ((panMs: number) => void) | null,
};
vi.mock("../bars/use-edge-autoscroll", () => ({
	useEdgeAutoScroll: () => autoScroll,
}));

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
	beforeEach(() => {
		autoScroll.onPan = null;
		autoScroll.start.mockReset();
		autoScroll.stop.mockReset();
		autoScroll.setPointer.mockReset();
		autoScroll.start.mockImplementation(
			(_x: number, _y: number, onPan?: (panMs: number) => void) => {
				autoScroll.onPan = onPan ?? null;
			},
		);
	});

	it("creates a task with the dragged dates and the row's assignee on release", async () => {
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-1" }),
		);
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

	it("tracks the cursor while dragging and clears it on release", async () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-1" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "u_ana" });
		});
		// A press with no movement yet publishes nothing, so a plain click on a
		// lane never flashes header feedback.
		expect(result.current.pointer).toBeNull();

		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		expect(result.current.pointer).toEqual({ x: 300 });

		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});
		expect(result.current.pointer).toBeNull();
	});

	it("starts edge autoscroll only once the press becomes a drag", () => {
		const onCreate = vi.fn(() => Promise.resolve({ id: "srv-1" }));
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "u_ana" });
		});
		// A press near an edge must not pan the timeline out from under the user.
		expect(autoScroll.start).not.toHaveBeenCalled();

		act(() => {
			fireEvent.pointerMove(window, { clientX: 102 }); // under threshold
		});
		expect(autoScroll.start).not.toHaveBeenCalled();

		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		expect(autoScroll.start).toHaveBeenCalled();

		act(() => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});
		expect(autoScroll.stop).toHaveBeenCalled();
	});

	it("keeps the anchor day pinned to content while autoscroll pans the view", async () => {
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-1" }),
		);
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		// Press on day 1 (x=100 → 100/800 * 7 days at weeks zoom), drag right.
		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "u_ana" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		const beforePan = result.current.draft;

		// Two frames of autoscroll to the right, cursor parked at the edge.
		act(() => {
			autoScroll.onPan?.(ONE_DAY);
			autoScroll.onPan?.(ONE_DAY);
		});
		const afterPan = result.current.draft;

		// The start day is unchanged — only the moving end absorbs the pan.
		expect(afterPan?.startDate).toBe(beforePan?.startDate);
		expect(afterPan?.endDate).not.toBe(beforePan?.endDate);
		expect(afterPan?.endDate).toBe(
			toUtcDateString(
				Date.parse(`${beforePan?.endDate}T00:00:00Z`) + 2 * ONE_DAY,
			),
		);

		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});
		// The committed span is the panned one, not the on-screen pixel span.
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			startDate: afterPan?.startDate,
			endDate: afterPan?.endDate,
		});
	});

	it("abandons the gesture on Escape and creates nothing", async () => {
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-1" }),
		);
		const { result } = renderHook(() =>
			useLaneCreate({ geom, today, onCreate }),
		);

		act(() => {
			result.current.beginCreate(pointerDownEvent(100), { key: "u_ana" });
		});
		act(() => {
			fireEvent.pointerMove(window, { clientX: 300 });
		});
		expect(result.current.draft).not.toBeNull();

		act(() => {
			fireEvent.keyDown(window, { key: "Escape" });
		});
		// Ghost and header feedback both drop, and autoscroll stops.
		expect(result.current.draft).toBeNull();
		expect(result.current.pointer).toBeNull();
		expect(autoScroll.stop).toHaveBeenCalled();

		// The release that follows the cancel must not resurrect the create.
		await act(async () => {
			fireEvent.pointerUp(window, { clientX: 300 });
		});
		expect(onCreate).not.toHaveBeenCalled();
		expect(result.current.renamingId).toBeNull();
	});

	it("does not create on a click (no drag past threshold)", async () => {
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-1" }),
		);
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
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-2" }),
		);
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
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "x" }),
		);
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
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-3" }),
		);
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
		const onCreate = vi.fn(
			(_input: {
				name: string;
				startDate: string;
				endDate: string;
				assigneeId?: string;
			}) => Promise.resolve({ id: "srv-4" }),
		);
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
