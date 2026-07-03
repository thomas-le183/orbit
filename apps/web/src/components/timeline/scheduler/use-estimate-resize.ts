import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { estimateFromDrag } from "./lane-metrics";

export type EstimateDraft = { id: string; estimatedTime: number };

/**
 * Vertical pointer-drag on a scheduler bar's bottom edge. Produces a live
 * `draft` estimatedTime during the gesture and commits the snapped value on
 * release. Mirrors the pointer lifecycle of bars/use-bar-interaction (capture,
 * window listeners, unmount cleanup, single-gesture guard) minus zoom/autoscroll.
 */
export function useEstimateResize(opts: {
	onCommit: (id: string, estimatedTime: number) => void;
}): {
	draft: EstimateDraft | null;
	active: string | null;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number },
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
		(e: ReactPointerEvent, target: { id: string; startHeight: number }) => {
			if (activeListenersRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const startY = e.clientY;
			const target0 = e.currentTarget;
			try {
				target0.setPointerCapture(e.pointerId);
			} catch {}

			const compute = (clientY: number): EstimateDraft => ({
				id: target.id,
				estimatedTime: estimateFromDrag(target.startHeight, clientY - startY),
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
