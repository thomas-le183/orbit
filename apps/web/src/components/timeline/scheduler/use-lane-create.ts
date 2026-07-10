import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEdgeAutoScroll } from "../bars/use-edge-autoscroll";
import { type Geometry, pxPerMs } from "../controller/geometry";
import { draftRangeFromDrag } from "../draft/draft-range";

/**
 * Horizontal travel (px) past which a press counts as a create-drag. Must be
 * >= draft-range's CLICK_THRESHOLD_PX (4) so that any release we act on always
 * maps to the dragged span, never draftRangeFromDrag's default-span branch.
 */
const CREATE_DRAG_THRESHOLD_PX = 4;

export type LaneCreateDraft = {
	laneKey: string;
	startDate: string;
	endDate: string;
};

/**
 * Pointer-driven "drag on an empty assignee lane to create a task" gesture.
 * Sketches a live date range (ghost) during the drag and, on release past the
 * threshold, creates a task pre-assigned to the row and marks it for inline
 * rename. Mirrors useEstimateResize's lifecycle (window listeners, single-
 * gesture guard, unmount cleanup); reuses draftRangeFromDrag for the math.
 */
export function useLaneCreate(opts: {
	geom: Geometry;
	today: number;
	onCreate: (input: {
		name: string;
		startDate: string;
		endDate: string;
		assigneeId?: string;
	}) => Promise<{ id: string }>;
}): {
	draft: LaneCreateDraft | null;
	/** Cursor x (client px) while the create-drag is live, for header feedback. */
	pointer: { x: number } | null;
	beginCreate: (
		e: ReactPointerEvent,
		row: { key: string; assigneeId?: string },
	) => void;
	renamingId: string | null;
	clearRenaming: () => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const listenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
		key: (e: KeyboardEvent) => void;
	} | null>(null);

	const [draft, setDraft] = useState<LaneCreateDraft | null>(null);
	const [pointer, setPointer] = useState<{ x: number } | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	// Horizontal only: the lane is latched at press, so scrolling rows under the
	// cursor would just disorient.
	const edgeScroll = useEdgeAutoScroll({ vertical: false });

	useEffect(() => {
		return () => {
			if (listenersRef.current) {
				window.removeEventListener("pointermove", listenersRef.current.move);
				window.removeEventListener("pointerup", listenersRef.current.up);
				window.removeEventListener("keydown", listenersRef.current.key, true);
				listenersRef.current = null;
			}
		};
	}, []);

	const clearRenaming = useCallback(() => setRenamingId(null), []);

	const beginCreate = useCallback(
		(e: ReactPointerEvent, row: { key: string; assigneeId?: string }) => {
			if (listenersRef.current) return;
			e.preventDefault();
			const rect = e.currentTarget.getBoundingClientRect();
			const startX = e.clientX;
			const startY = e.clientY;
			let moved = false;
			let lastX = startX;
			// Time the viewport has panned under the cursor since the press. The
			// geometry is frozen at press-time, so the anchor day stays pinned to
			// the content and only the moving end absorbs the pan.
			let panAccumMs = 0;
			const geom0 = optsRef.current.geom;
			const today0 = optsRef.current.today;

			const rangeAt = (clientX: number) =>
				draftRangeFromDrag(
					startX,
					clientX + panAccumMs * pxPerMs(geom0.zoom),
					rect,
					geom0,
					today0,
					moved,
				);

			const paint = (clientX: number) => {
				const r = rangeAt(clientX);
				setDraft({ laneKey: row.key, ...r });
				setPointer({ x: clientX });
			};

			const onMove = (ev: PointerEvent) => {
				lastX = ev.clientX;
				if (Math.abs(ev.clientX - startX) > CREATE_DRAG_THRESHOLD_PX) {
					moved = true;
				}
				if (!moved) return;
				// Only once the press is a real drag; otherwise a click near the
				// edge would pan the timeline out from under the user.
				edgeScroll.start(ev.clientX, startY, (panMs) => {
					panAccumMs += panMs;
					paint(lastX);
				});
				edgeScroll.setPointer(ev.clientX, startY);
				paint(ev.clientX);
			};

			/** Ends the gesture and drops the ghost, without creating anything. */
			const teardown = () => {
				edgeScroll.stop();
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				window.removeEventListener("keydown", onKey, true);
				listenersRef.current = null;
				setDraft(null);
				setPointer(null);
			};

			const onUp = () => {
				teardown();
				if (!moved) return;
				const r = rangeAt(lastX);
				optsRef.current
					.onCreate({
						name: "New task",
						startDate: r.startDate,
						endDate: r.endDate,
						...(row.assigneeId ? { assigneeId: row.assigneeId } : {}),
					})
					.then((task) => setRenamingId(task.id))
					.catch(() => {
						/* create failed: useCreateTask surfaces the error toast */
					});
			};

			// Escape abandons the gesture. Tearing down first means the later
			// pointerup lands on no listener, so nothing is ever created.
			const onKey = (ev: KeyboardEvent) => {
				if (ev.key !== "Escape") return;
				ev.preventDefault();
				ev.stopPropagation();
				teardown();
			};

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			// Capture phase: beat the view-level Escape handler that clears selection.
			window.addEventListener("keydown", onKey, true);
			listenersRef.current = { move: onMove, up: onUp, key: onKey };
		},
		[edgeScroll.start, edgeScroll.stop, edgeScroll.setPointer],
	);

	return { draft, pointer, beginCreate, renamingId, clearRenaming };
}
