import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Geometry } from "../controller/geometry";
import { draftRangeFromDrag } from "../draft/draft-range";

/** Pointer travel (px) past which a press on a panel row counts as a drag. */
const DRAG_THRESHOLD_PX = 3;

export type UnplannedDropDraft = {
	taskId: string;
	laneKey: string;
	startDate: string;
	endDate: string;
};

export type UnplannedDragSource = { id: string; name: string };

/**
 * Drag an unplanned task out of the side panel and drop it onto an assignee
 * lane to schedule it. Mirrors useLaneCreate/useBarDrag's pointer lifecycle
 * (window listeners, single-gesture guard, unmount cleanup).
 *
 * The drop lands on the single day under the pointer: `draftRangeFromDrag` with
 * an identical start/end x collapses to one inclusive day, which reuses the
 * exact pixel→day conversion the create-drag already uses.
 */
export function useUnplannedDrag(opts: {
	geom: Geometry;
	today: number;
	viewportRef: RefObject<HTMLDivElement | null>;
	/**
	 * The panel overlays the viewport's right edge, so its box sits *inside* the
	 * viewport rect. Subtract it, or releasing back over the panel — the natural
	 * "never mind" gesture — would schedule at the date hidden beneath it.
	 */
	excludeRef: RefObject<HTMLElement | null>;
	resolveLaneAt: (clientY: number) => { key: string | null; contentY: number };
	onDrop: (
		taskId: string,
		dates: { startDate: string; endDate: string },
		laneKey: string,
	) => void;
}): {
	draft: UnplannedDropDraft | null;
	source: UnplannedDragSource | null;
	pointer: { x: number; y: number } | null;
	beginDrag: (e: ReactPointerEvent, task: UnplannedDragSource) => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const listenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);

	const [draft, setDraft] = useState<UnplannedDropDraft | null>(null);
	const [source, setSource] = useState<UnplannedDragSource | null>(null);
	const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

	useEffect(() => {
		return () => {
			if (listenersRef.current) {
				window.removeEventListener("pointermove", listenersRef.current.move);
				window.removeEventListener("pointerup", listenersRef.current.up);
				listenersRef.current = null;
			}
		};
	}, []);

	const beginDrag = useCallback(
		(e: ReactPointerEvent, task: UnplannedDragSource) => {
			if (listenersRef.current) return;
			e.preventDefault();
			const startX = e.clientX;
			const startY = e.clientY;
			let moved = false;

			setSource(task);

			/**
			 * A drop only counts while the pointer is over the lanes, so releasing
			 * back over the panel (or outside the viewport entirely) cancels rather
			 * than scheduling at a nonsense date.
			 */
			const draftAt = (
				clientX: number,
				clientY: number,
			): UnplannedDropDraft | null => {
				const el = optsRef.current.viewportRef.current;
				if (!el) return null;
				const rect = el.getBoundingClientRect();
				const inside =
					clientX >= rect.left &&
					clientX <= rect.right &&
					clientY >= rect.top &&
					clientY <= rect.bottom;
				if (!inside) return null;

				const panel = optsRef.current.excludeRef.current;
				if (panel) {
					const p = panel.getBoundingClientRect();
					const overPanel =
						p.width > 0 &&
						clientX >= p.left &&
						clientX <= p.right &&
						clientY >= p.top &&
						clientY <= p.bottom;
					if (overPanel) return null;
				}

				const lane = optsRef.current.resolveLaneAt(clientY);
				if (lane.key == null) return null;

				const { startDate, endDate } = draftRangeFromDrag(
					clientX,
					clientX,
					rect,
					optsRef.current.geom,
					optsRef.current.today,
					true,
				);
				return { taskId: task.id, laneKey: lane.key, startDate, endDate };
			};

			const onMove = (ev: PointerEvent) => {
				if (
					!moved &&
					Math.hypot(ev.clientX - startX, ev.clientY - startY) >
						DRAG_THRESHOLD_PX
				) {
					moved = true;
				}
				setPointer({ x: ev.clientX, y: ev.clientY });
				if (moved) setDraft(draftAt(ev.clientX, ev.clientY));
			};

			const onUp = (ev: PointerEvent) => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				listenersRef.current = null;

				const landed = moved ? draftAt(ev.clientX, ev.clientY) : null;
				setDraft(null);
				setSource(null);
				setPointer(null);
				if (landed) {
					optsRef.current.onDrop(
						landed.taskId,
						{ startDate: landed.startDate, endDate: landed.endDate },
						landed.laneKey,
					);
				}
			};

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			listenersRef.current = { move: onMove, up: onUp };
		},
		[],
	);

	return { draft, source, pointer, beginDrag };
}
