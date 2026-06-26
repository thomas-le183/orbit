import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTimelineController } from "./controller/context";
import { PX_PER_DAY } from "./controller/geometry";
import { ONE_DAY, toUtcDateString } from "./units/make-units";
import type { RelativeTimeRangeOffset, ZoomLevel } from "./units/types";

export type ResizeEdge = "start" | "end";

/** Pixel delta → whole-day delta at the given zoom (day-snapped). */
export const pxToDays = (dx: number, zoom: ZoomLevel): number => {
	const days = dx / PX_PER_DAY[zoom];
	return days >= 0 ? Math.floor(days + 0.5) : Math.ceil(days - 0.5);
};

export const applyMove = (
	range: RelativeTimeRangeOffset,
	days: number,
): RelativeTimeRangeOffset => ({
	from: range.from + days * ONE_DAY,
	to: range.to + days * ONE_DAY,
});

export const applyResize = (
	range: RelativeTimeRangeOffset,
	edge: ResizeEdge,
	days: number,
	minDays = 1,
): RelativeTimeRangeOffset => {
	const min = minDays * ONE_DAY;
	if (edge === "start") {
		const from = Math.min(range.from + days * ONE_DAY, range.to - min);
		return { from, to: range.to };
	}
	const to = Math.max(range.to + days * ONE_DAY, range.from + min);
	return { from: range.from, to };
};

/** Inverse of layout's ownRange: exclusive `to` (+1 day) → inclusive end date. */
export const rangeToDates = (
	range: RelativeTimeRangeOffset,
	today: number,
): { startDate: string; endDate: string } => ({
	startDate: toUtcDateString(today + range.from),
	endDate: toUtcDateString(today + range.to - ONE_DAY),
});

export type GestureRole = "move" | "resize-start" | "resize-end";

export type GestureTarget = {
	role: GestureRole;
	id: string;
	range: RelativeTimeRangeOffset;
	/** leaf/milestone ids shifted alongside a parent move; empty otherwise. */
	descendantIds: string[];
};

/**
 * Pointer-driven move/resize. Produces a live `draft` (id → range) during the
 * gesture and commits a day-snapped edit on release.
 */
export function useBarInteraction(opts: {
	onCommitMove: (id: string, days: number) => void;
	onCommitResize: (id: string, range: RelativeTimeRangeOffset) => void;
}): {
	draft: Record<string, RelativeTimeRangeOffset>;
	beginGesture: (e: ReactPointerEvent, target: GestureTarget) => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const activeListenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);

	const { zoomLevel } = useTimelineController();
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;
	const [draft, setDraft] = useState<Record<string, RelativeTimeRangeOffset>>(
		{},
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

	const beginGesture = useCallback(
		(e: ReactPointerEvent, target: GestureTarget) => {
			// Ignore a second pointerdown while a gesture is already active so we
			// never orphan the first gesture's window listeners.
			if (activeListenersRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const startX = e.clientX;
			const target0 = e.currentTarget;
			try {
				target0.setPointerCapture(e.pointerId);
			} catch {}

			const compute = (dx: number): Record<string, RelativeTimeRangeOffset> => {
				const days = pxToDays(dx, zoomRef.current);
				if (target.role === "move") {
					return { [target.id]: applyMove(target.range, days) };
				}
				const edge = target.role === "resize-start" ? "start" : "end";
				return { [target.id]: applyResize(target.range, edge, days) };
			};

			const onMove = (ev: PointerEvent) => {
				setDraft(compute(ev.clientX - startX));
			};
			const onUp = (ev: PointerEvent) => {
				const days = pxToDays(ev.clientX - startX, zoomRef.current);
				if (target.role === "move")
					optsRef.current.onCommitMove(target.id, days);
				else
					optsRef.current.onCommitResize(
						target.id,
						applyResize(
							target.range,
							target.role === "resize-start" ? "start" : "end",
							days,
						),
					);
				setDraft({});
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
		[],
	);

	return { draft, beginGesture };
}
