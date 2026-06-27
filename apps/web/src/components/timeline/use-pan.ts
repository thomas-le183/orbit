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
		// Horizontal-intent wheel pans time; vertical wheel falls through to the
		// native vertical scroll of the rows container.
		if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
		setOffsetMs((prev) => prev + e.deltaX * msPerPx());
	};

	return { onWheel };
}
