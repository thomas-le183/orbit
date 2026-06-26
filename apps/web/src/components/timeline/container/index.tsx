import { type RefObject, useEffect, useRef } from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "../header/time-units-bar";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import TaskBars from "../task-bars";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";

function TimelineCanvas() {
	const { setViewportWidth, scrollToToday } = useTimelineController();
	const ref = useRef<HTMLDivElement>(null);
	const { onPointerDown, onWheel } = usePan();
	const { width = 0 } = useResizeObserver({
		ref: ref as RefObject<HTMLDivElement>,
	});

	useEffect(() => {
		setViewportWidth(width);
	}, [width, setViewportWidth]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-border p-2">
				<button
					type="button"
					onClick={scrollToToday}
					className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
				>
					Today
				</button>
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
					<TaskBars />
					<NowLine />
				</div>
			</div>
			{/* synthetic horizontal scrollbar (drag thumb / click track to pan) */}
			<TimelineScrollbar />
		</div>
	);
}

export default function TimelineContainer() {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<TimelineCanvas />
		</TimelineProvider>
	);
}
