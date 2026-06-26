import { useEffect, useRef } from "react";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "../header/time-units-bar";
import NowLine from "../now-line";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";

function TimelineCanvas() {
	const { setViewportWidth } = useTimelineController();
	const ref = useRef<HTMLDivElement>(null);
	const { onPointerDown, onWheel } = usePan();

	// Measure the viewport width and keep it in sync on resize.
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => setViewportWidth(el.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [setViewportWidth]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-end border-b border-border p-2">
				<ZoomControl />
			</div>
			<div
				ref={ref}
				className="relative flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
				onPointerDown={onPointerDown}
				onWheel={onWheel}
			>
				{/* header band */}
				<div className="absolute inset-x-0 top-0 h-12">
					<TimeUnitsBar />
				</div>
				{/* grid + now-line fill below the header */}
				<div className="absolute inset-x-0 bottom-0 top-12">
					<TimelineGrid />
					<NowLine />
				</div>
			</div>
		</div>
	);
}

export default function TimelineContainer() {
	return (
		<TimelineProvider>
			<TimelineCanvas />
		</TimelineProvider>
	);
}
