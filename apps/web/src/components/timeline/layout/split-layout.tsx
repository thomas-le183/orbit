import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "../header/time-units-bar";
import ItemsLayer from "../items-layer";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { usePan } from "../use-pan";
import { useResizableDivider } from "./use-resizable-divider";

type SplitLayoutProps = {
	tableHeader: ReactNode;
	table: ReactNode;
	initialTableWidth?: number;
};

function SplitLayoutInner({
	tableHeader,
	table,
	initialTableWidth,
}: SplitLayoutProps) {
	const { setViewportWidth } = useTimelineController();
	const { tableWidth, onDividerPointerDown } =
		useResizableDivider(initialTableWidth);
	const { onWheel } = usePan();

	// Measure the timeline (right) region so viewportWidth excludes the table column.
	const rightRef = useRef<HTMLDivElement>(null);
	const { width = 0 } = useResizeObserver({
		ref: rightRef as RefObject<HTMLDivElement>,
	});
	useEffect(() => {
		setViewportWidth(width);
	}, [width, setViewportWidth]);

	return (
		<div className="relative flex h-full flex-col">
			{/* header band */}
			<div className="flex h-12 shrink-0 border-b border-border">
				<div
					className="shrink-0 border-r border-border"
					style={{ width: tableWidth }}
				>
					{tableHeader}
				</div>
				<div className="relative flex-1">
					<TimeUnitsBar />
				</div>
			</div>

			{/* body */}
			<div className="relative flex-1 overflow-hidden">
				{/* pinned timeline background over the right region */}
				<div
					className="absolute inset-y-0 right-0"
					style={{ left: tableWidth }}
				>
					<TimelineGrid />
					<NowLine />
				</div>
				{/* shared vertical scroll: table column + items layer move together */}
				<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
					<div className="flex">
						<div
							data-testid="timeline-table-column"
							className="shrink-0 border-r border-border"
							style={{ width: tableWidth }}
						>
							{table}
						</div>
						<div
							ref={rightRef}
							className="relative flex-1 touch-none select-none"
							onWheel={onWheel}
						>
							<ItemsLayer />
						</div>
					</div>
				</div>
			</div>

			{/* full-height draggable divider */}
			<div
				data-testid="timeline-split-divider"
				onPointerDown={onDividerPointerDown}
				className="absolute inset-y-0 z-30 w-1 -translate-x-1/2 cursor-col-resize hover:bg-border"
				style={{ left: tableWidth }}
			/>

			{/* footer: horizontal scrollbar under the timeline region only */}
			<div className="flex shrink-0">
				<div className="shrink-0" style={{ width: tableWidth }} />
				<div className="relative flex-1">
					<TimelineScrollbar />
				</div>
			</div>
		</div>
	);
}

export default function SplitLayout(props: SplitLayoutProps) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<SplitLayoutInner {...props} />
		</TimelineProvider>
	);
}
