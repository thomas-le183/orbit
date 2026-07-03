import { useCallback, useEffect, useRef } from "react";
import {
	EDGE_SCROLL_MAX_PX_PER_FRAME,
	EDGE_SCROLL_ZONE_PX,
} from "../constants";
import { useTimelineController } from "../controller/context";
import { pxPerMs } from "../controller/geometry";

/** 0 at the inner edge of the zone, ramping to 1 at (or past) the viewport edge. */
const intensity = (distanceFromEdge: number): number =>
	Math.min(
		1,
		Math.max(0, (EDGE_SCROLL_ZONE_PX - distanceFromEdge) / EDGE_SCROLL_ZONE_PX),
	);

/**
 * Signed px/frame to scroll along one axis given how far the pointer sits from
 * the near/far edges of a viewport. Negative = toward the low edge (left/top),
 * positive = toward the high edge (right/bottom), 0 = outside both zones.
 */
const edgeVelocity = (fromLow: number, fromHigh: number): number => {
	if (fromLow < EDGE_SCROLL_ZONE_PX)
		return -intensity(fromLow) * EDGE_SCROLL_MAX_PX_PER_FRAME;
	if (fromHigh < EDGE_SCROLL_ZONE_PX)
		return intensity(fromHigh) * EDGE_SCROLL_MAX_PX_PER_FRAME;
	return 0;
};

/**
 * Edge-triggered auto-scroll for pointer gestures. While running, each animation
 * frame it checks the tracked pointer against the viewport edges and:
 *  - pans the controller's `offsetMs` horizontally (toward the left/right edge), and
 *  - scrolls the rows container vertically (toward the top/bottom edge).
 *
 * Shared by bar drag/resize and dependency-link drags. `onPan` fires whenever a
 * scroll happened (either axis) with the per-frame horizontal pan in ms, so a
 * caller can keep a draft or hit test in step with the scroll.
 */
export function useEdgeAutoScroll() {
	const { zoomLevel, setOffsetMs, viewportRef, scrollContainerRef } =
		useTimelineController();
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;

	const rafRef = useRef<number | null>(null);
	const pointerRef = useRef({ x: 0, y: 0 });
	const onPanRef = useRef<((panMs: number) => void) | null>(null);

	const stop = useCallback(() => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		onPanRef.current = null;
	}, []);

	// Cancel any in-flight loop if the component unmounts mid-gesture.
	useEffect(() => stop, [stop]);

	/** Latest cursor position (viewport coords); the loop reads this each frame. */
	const setPointer = useCallback((x: number, y: number) => {
		pointerRef.current = { x, y };
	}, []);

	const start = useCallback(
		(initialX: number, initialY: number, onPan?: (panMs: number) => void) => {
			pointerRef.current = { x: initialX, y: initialY };
			onPanRef.current = onPan ?? null;
			if (rafRef.current !== null) return; // already looping

			const step = () => {
				const { x, y } = pointerRef.current;
				let panMs = 0;
				let scrolled = false;

				// Horizontal: pan time via the pannable (timeline) region's edges.
				const hEl = viewportRef.current;
				if (hEl) {
					const rect = hEl.getBoundingClientRect();
					const panPx = edgeVelocity(x - rect.left, rect.right - x);
					if (panPx !== 0) {
						panMs = panPx / pxPerMs(zoomRef.current);
						setOffsetMs((prev) => prev + panMs);
					}
				}

				// Vertical: scroll the rows container via its top/bottom edges.
				const vEl = scrollContainerRef.current;
				if (vEl) {
					const rect = vEl.getBoundingClientRect();
					const scrollPx = edgeVelocity(y - rect.top, rect.bottom - y);
					if (scrollPx !== 0) {
						const before = vEl.scrollTop;
						vEl.scrollTop = before + scrollPx;
						scrolled = vEl.scrollTop !== before;
					}
				}

				if (panMs !== 0 || scrolled) onPanRef.current?.(panMs);
				rafRef.current = requestAnimationFrame(step);
			};
			rafRef.current = requestAnimationFrame(step);
		},
		[setOffsetMs, viewportRef, scrollContainerRef],
	);

	return { start, stop, setPointer };
}
