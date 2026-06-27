import { ChevronLeft, ChevronRight } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import { msPerViewport } from "../controller/geometry";
import TimeUnitsBar from "../header/time-units-bar";
import ItemsLayer from "../items-layer";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";

/** Fraction of a viewport the arrow buttons pan per click. */
const PAN_STEP = 0.5;

function TimelineCanvas() {
	const {
		setViewportWidth,
		scrollToToday,
		setOffsetMs,
		zoomLevel,
		viewportWidth,
	} = useTimelineController();
	const ref = useRef<HTMLDivElement>(null);
	const { onWheel } = usePan();
	const { width = 0 } = useResizeObserver({
		ref: ref as RefObject<HTMLDivElement>,
	});

	useEffect(() => {
		setViewportWidth(width);
	}, [width, setViewportWidth]);

	// Pan the view by a fraction of a viewport (negative = earlier, positive = later).
	const panViewports = (fraction: number) => {
		setOffsetMs(
			(prev) =>
				prev +
				fraction *
					msPerViewport({ offsetMs: prev, zoom: zoomLevel, viewportWidth }),
		);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-border p-2">
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						aria-label="Scroll to earlier dates"
						data-testid="timeline-pan-earlier"
						onClick={() => panViewports(-PAN_STEP)}
						className="rounded-md border border-border p-1 hover:bg-accent"
					>
						<ChevronLeft className="size-4" />
					</button>
					<button
						type="button"
						onClick={scrollToToday}
						className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
					>
						Today
					</button>
					<button
						type="button"
						aria-label="Scroll to later dates"
						data-testid="timeline-pan-later"
						onClick={() => panViewports(PAN_STEP)}
						className="rounded-md border border-border p-1 hover:bg-accent"
					>
						<ChevronRight className="size-4" />
					</button>
				</div>
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
