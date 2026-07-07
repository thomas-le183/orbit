import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Geometry } from "../controller/geometry";
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
	} | null>(null);

	const [draft, setDraft] = useState<LaneCreateDraft | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			if (listenersRef.current) {
				window.removeEventListener("pointermove", listenersRef.current.move);
				window.removeEventListener("pointerup", listenersRef.current.up);
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
			let moved = false;
			let lastX = startX;

			const rangeAt = (clientX: number) =>
				draftRangeFromDrag(
					startX,
					clientX,
					rect,
					optsRef.current.geom,
					optsRef.current.today,
					moved,
				);

			const onMove = (ev: PointerEvent) => {
				lastX = ev.clientX;
				if (Math.abs(ev.clientX - startX) > CREATE_DRAG_THRESHOLD_PX) {
					moved = true;
				}
				if (moved) {
					const r = rangeAt(ev.clientX);
					setDraft({ laneKey: row.key, ...r });
				}
			};

			const onUp = () => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				listenersRef.current = null;
				setDraft(null);
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

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			listenersRef.current = { move: onMove, up: onUp };
		},
		[],
	);

	return { draft, beginCreate, renamingId, clearRenaming };
}
