import { type RefObject, useEffect, useRef } from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "../header/time-units-bar";
import ItemsLayer from "../items-layer";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";

function TimelineCanvas() {
	const { setViewportWidth, scrollToToday } = useTimelineController();
	const ref = useRef<HTMLDivElement>(null);
	const { onWheel } = usePan();
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
				className="relative flex-1 touch-none select-none overflow-hidden"
				onWheel={onWheel}
			>
				{/* header band */}
				<div className="absolute inset-x-0 top-0 h-12">
					<TimeUnitsBar />
				</div>
				{/* grid + now-line fill below the header (pinned — vertical lines are
				    identical at any scroll position); only the bars scroll vertically */}
				<div className="absolute inset-x-0 bottom-0 top-12">
					<TimelineGrid />
					<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
						<ItemsLayer />
					</div>
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
