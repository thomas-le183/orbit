import type {
	PointerEvent as ReactPointerEvent,
	WheelEvent as ReactWheelEvent,
} from "react";
import { useRef } from "react";
import { useTimelineController } from "./controller/context";
import { pxPerMs } from "./controller/geometry";

/** Pointer-drag + wheel horizontal panning that updates the controller's offsetMs. */
export function usePan() {
	const { zoomLevel, setOffsetMs } = useTimelineController();
	const dragX = useRef<number | null>(null);
	const zoomRef = useRef(zoomLevel);
	zoomRef.current = zoomLevel;

	const msPerPx = () => 1 / pxPerMs(zoomRef.current);

	const onPointerDown = (e: ReactPointerEvent) => {
		dragX.current = e.clientX;
		const target = e.currentTarget;
		const pointerId = e.pointerId;
		target.setPointerCapture(pointerId);

		const onMove = (ev: PointerEvent) => {
			if (dragX.current === null) return;
			const dx = ev.clientX - dragX.current;
			dragX.current = ev.clientX;
			// drag right → reveal earlier time → offsetMs decreases
			setOffsetMs((prev) => prev - dx * msPerPx());
		};
		const onUp = () => {
			dragX.current = null;
			try {
				target.releasePointerCapture(pointerId);
			} catch {}
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const onWheel = (e: ReactWheelEvent) => {
		const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		setOffsetMs((prev) => prev + dx * msPerPx());
	};

	return { onPointerDown, onWheel };
}
