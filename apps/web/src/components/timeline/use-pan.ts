import type { WheelEvent as ReactWheelEvent } from "react";
import { useRef } from "react";
import { useTimelineController } from "./controller/context";
import { pxPerMs } from "./controller/geometry";

/** Wheel-based horizontal panning that updates the controller's offsetMs. */
export function usePan() {
	const { zoomLevel, setOffsetMs } = useTimelineController();
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;

	const msPerPx = () => 1 / pxPerMs(zoomRef.current);

	const onWheel = (e: ReactWheelEvent) => {
		// Shift + wheel scrolls horizontally. Some browsers already remap the
		// delta onto deltaX, others leave it on deltaY with shiftKey set, so
		// take whichever axis carries the scroll.
		if (e.shiftKey) {
			const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
			setOffsetMs((prev) => prev + delta * msPerPx());
			return;
		}
		// Horizontal-intent wheel pans time; vertical wheel falls through to the
		// native vertical scroll of the rows container.
		if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
		setOffsetMs((prev) => prev + e.deltaX * msPerPx());
	};

	return { onWheel };
}
