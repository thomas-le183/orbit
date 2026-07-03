import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	applyMove,
	applyResize,
	pxToDays,
	rangeToDates,
	type ResizeEdge,
} from "../bars/use-bar-interaction";
import { useEdgeAutoScroll } from "../bars/use-edge-autoscroll";
import { useTimelineController } from "../controller/context";
import { pxPerMs } from "../controller/geometry";
import type { RelativeTimeRangeOffset } from "../units/types";

export type DragRole = "move" | "resize-start" | "resize-end";

export type DragTarget = {
	id: string;
	role: DragRole;
	range: RelativeTimeRangeOffset;
	/** The bar's current lane key; used to detect a reassign. Move role only. */
	laneKey?: string;
};

/** Pixels of pointer travel past which a press counts as a drag, not a tap. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Pointer-driven horizontal move/resize for scheduler bars. Produces a live
 * `draft` range and commits day-snapped dates on release. Composes the Gantt's
 * pure helpers; mirrors the pointer lifecycle of use-bar-interaction (capture,
 * window listeners, unmount cleanup, single-gesture guard, edge-autoscroll).
 */
export function useBarDrag(opts: {
	onCommit: (
		id: string,
		dates: { startDate: string; endDate: string },
		targetLaneKey: string | null,
	) => void;
	resolveLaneAt?: (clientY: number) => { key: string | null; contentY: number };
}): {
	draft:
		| {
				id: string;
				range: RelativeTimeRangeOffset;
				targetLaneKey?: string | null;
				pointerContentY?: number;
		  }
		| null;
	active: { id: string; role: DragRole } | null;
	beginDrag: (e: ReactPointerEvent, target: DragTarget) => void;
	wasDragged: () => boolean;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const activeListenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);
	const draggedRef = useRef(false);

	const { zoomLevel, today } = useTimelineController();
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;
	const todayRef = useRef(today);
	todayRef.current = today;
	const edgeScroll = useEdgeAutoScroll();

	const [draft, setDraft] = useState<{
		id: string;
		range: RelativeTimeRangeOffset;
		targetLaneKey?: string | null;
		pointerContentY?: number;
	} | null>(null);
	const [active, setActive] = useState<{ id: string; role: DragRole } | null>(
		null,
	);

	useEffect(() => {
		return () => {
			if (activeListenersRef.current) {
				window.removeEventListener(
					"pointermove",
					activeListenersRef.current.move,
				);
				window.removeEventListener("pointerup", activeListenersRef.current.up);
				activeListenersRef.current = null;
			}
		};
	}, []);

	const beginDrag = useCallback(
		(e: ReactPointerEvent, target: DragTarget) => {
			if (activeListenersRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const startX = e.clientX;
			const target0 = e.currentTarget;
			try {
				target0.setPointerCapture(e.pointerId);
			} catch {}

			draggedRef.current = false;
			setActive({ id: target.id, role: target.role });

			let panAccumMs = 0;
			let lastPointerX = startX;
			let lastPointerY = e.clientY;

			const totalDays = (): number =>
				pxToDays(
					lastPointerX - startX + panAccumMs * pxPerMs(zoomRef.current),
					zoomRef.current,
				);

			const computeRange = (): RelativeTimeRangeOffset => {
				const days = totalDays();
				if (target.role === "move") return applyMove(target.range, days);
				const edge: ResizeEdge =
					target.role === "resize-start" ? "start" : "end";
				return applyResize(target.range, edge, days);
			};

			const resolveLane = (
				clientY: number,
			): { key: string | null; contentY: number } | null => {
				if (target.role !== "move" || !optsRef.current.resolveLaneAt) return null;
				return optsRef.current.resolveLaneAt(clientY);
			};

			const buildDraft = (clientY: number) => {
				const lane = resolveLane(clientY);
				return {
					id: target.id,
					range: computeRange(),
					targetLaneKey: lane ? lane.key : undefined,
					pointerContentY: lane ? lane.contentY : undefined,
				};
			};

			setDraft(buildDraft(e.clientY));

			edgeScroll.start(startX, e.clientY, (panMs) => {
				panAccumMs += panMs;
				setDraft(buildDraft(lastPointerY));
			});

			const onMove = (ev: PointerEvent) => {
				lastPointerX = ev.clientX;
				lastPointerY = ev.clientY;
				if (Math.abs(ev.clientX - startX) > DRAG_THRESHOLD_PX) {
					draggedRef.current = true;
				}
				edgeScroll.setPointer(ev.clientX, ev.clientY);
				setDraft(buildDraft(ev.clientY));
			};
			const onUp = (ev: PointerEvent) => {
				edgeScroll.stop();
				lastPointerX = ev.clientX;
				lastPointerY = ev.clientY;
				const finalRange = computeRange();
				const lane = resolveLane(ev.clientY);
				const laneChanged =
					lane != null && lane.key != null && lane.key !== target.laneKey;
				const rangeChanged =
					finalRange.from !== target.range.from ||
					finalRange.to !== target.range.to;
				if (rangeChanged || laneChanged) {
					optsRef.current.onCommit(
						target.id,
						rangeToDates(finalRange, todayRef.current),
						laneChanged ? (lane?.key ?? null) : null,
					);
				}
				setDraft(null);
				setActive(null);
				try {
					target0.releasePointerCapture(ev.pointerId);
				} catch {}
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				activeListenersRef.current = null;
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			activeListenersRef.current = { move: onMove, up: onUp };
		},
		[edgeScroll.start, edgeScroll.stop, edgeScroll.setPointer],
	);

	const wasDragged = useCallback(() => {
		const v = draggedRef.current;
		draggedRef.current = false;
		return v;
	}, []);

	return { draft, active, beginDrag, wasDragged };
}
