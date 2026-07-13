import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { perDayFromDrag } from "./lane-metrics";

export type EstimateDraft = { id: string; estimatedTime: number };

/**
 * Vertical pointer-drag on a scheduler bar's bottom edge. The height maps to a
 * per-day effort, which is multiplied by the bar's `days` span to produce the
 * total `estimatedTime` — so the same drag yields a larger total on a longer
 * task. Produces a live `draft` during the gesture and commits on release.
 * Mirrors the pointer lifecycle of bars/use-bar-interaction (capture, window
 * listeners, unmount cleanup, single-gesture guard) minus zoom/autoscroll.
 */
export function useEstimateResize(opts: {
	onCommit: (id: string, estimatedTime: number) => void;
}): {
	draft: EstimateDraft | null;
	active: string | null;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number; days: number },
	) => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;

	const activeListenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);

	const [draft, setDraft] = useState<EstimateDraft | null>(null);
	const [active, setActive] = useState<string | null>(null);

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

	const beginResize = useCallback(
		(
			e: ReactPointerEvent,
			target: { id: string; startHeight: number; days: number },
		) => {
			if (activeListenersRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const startY = e.clientY;
			const target0 = e.currentTarget;
			try {
				target0.setPointerCapture(e.pointerId);
			} catch {}

			// Height sets per-day effort; the total estimate is that spread across
			// the bar's day span.
			const compute = (clientY: number): EstimateDraft => ({
				id: target.id,
				estimatedTime:
					perDayFromDrag(target.startHeight, clientY - startY) *
					Math.max(1, target.days),
			});

			setActive(target.id);
			setDraft(compute(startY));

			const onMove = (ev: PointerEvent) => {
				setDraft(compute(ev.clientY));
			};
			const onUp = (ev: PointerEvent) => {
				const { id, estimatedTime } = compute(ev.clientY);
				optsRef.current.onCommit(id, estimatedTime);
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
		[],
	);

	return { draft, active, beginResize };
}
