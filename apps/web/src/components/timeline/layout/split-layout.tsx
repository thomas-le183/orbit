import { Button } from "@orbit/ui/components/button";
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import { msPerViewport } from "../controller/geometry";
import TimeUnitsBar from "../header/time-units-bar";
import ItemsLayer from "../items-layer";
import MilestoneMarkers from "../milestone-markers";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { RowSelectionProvider, useRowSelection } from "../selection/context";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";
import { useResizableDivider } from "./use-resizable-divider";

type SplitLayoutProps = {
	tableHeader: ReactNode;
	table: ReactNode;
	initialTableWidth?: number;
	onNewTask?: () => void;
};

/** Fraction of a viewport the arrow buttons / keys pan per step. */
const PAN_STEP = 0.25;

/** True when focus is in a field where arrow keys should keep their normal meaning. */
function isTypingTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	const tag = el.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT" ||
		el.isContentEditable
	);
}

function SplitLayoutInner({
	tableHeader,
	table,
	initialTableWidth,
	onNewTask,
}: SplitLayoutProps) {
	const {
		setViewportWidth,
		scrollToToday,
		setOffsetMs,
		zoomLevel,
		viewportWidth,
	} = useTimelineController();
	const { tableWidth, onDividerPointerDown } =
		useResizableDivider(initialTableWidth);
	const { onWheel } = usePan();
	const { clear } = useRowSelection();

	// Measure the timeline (right) region so viewportWidth excludes the table column.
	const rightRef = useRef<HTMLDivElement>(null);
	const { width = 0 } = useResizeObserver({
		ref: rightRef as RefObject<HTMLDivElement>,
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

	// Keep the keydown handler reading the latest panViewports without resubscribing.
	const panRef = useRef(panViewports);
	panRef.current = panViewports;

	// Left/Right arrow keys pan the timeline (unless the user is typing in a field).
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (isTypingTarget(e.target)) return;
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				panRef.current(-PAN_STEP);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				panRef.current(PAN_STEP);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// Esc clears the row selection (unless focus is in a typing field).
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isTypingTarget(e.target)) clear();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [clear]);

	return (
		<div className="relative flex h-full flex-col">
			{/* toolbar */}
			<div className="flex items-center justify-between border-b border-border p-2">
				<div className="flex items-center gap-1.5">
					{onNewTask && (
						<Button variant="outline" size="sm" onClick={onNewTask}>
							<PlusIcon className="size-3.5" />
							New task
						</Button>
					)}
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
			{/* split region (table | timeline) — divider spans only this, not the toolbar */}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{/* header band */}
				<div className="relative z-20 flex h-12 shrink-0 border-b border-border">
					<div
						className="relative z-20 shrink-0 overflow-hidden border-r border-border bg-muted/40"
						style={{ width: tableWidth }}
					>
						{tableHeader}
					</div>
					<div className="relative" style={{ width: viewportWidth }}>
						<TimeUnitsBar />
					</div>
				</div>

				{/* body */}
				<div className="relative flex-1 overflow-hidden">
					{/* pinned timeline background over the right region */}
					<div
						className="absolute inset-y-0"
						style={{ left: tableWidth, width: viewportWidth }}
					>
						<TimelineGrid />
						<NowLine />
						<MilestoneMarkers />
					</div>
					{/* shared vertical scroll: table column + items layer move together */}
					<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
						<div className="flex min-h-full">
							<div
								data-testid="timeline-table-column"
								className="relative z-20 min-h-full shrink-0 overflow-hidden border-r border-border bg-background-primary"
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
					className="absolute inset-y-0 z-30 w-3 -translate-x-1/2 cursor-col-resize hover:bg-border"
					style={{ left: tableWidth }}
				/>

				{/* footer: horizontal scrollbar under the timeline region only */}
				<div className="flex shrink-0">
					<div className="shrink-0" style={{ width: tableWidth }} />
					<div className="relative" style={{ width: viewportWidth }}>
						<TimelineScrollbar />
					</div>
				</div>
			</div>
		</div>
	);
}

export default function SplitLayout(props: SplitLayoutProps) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<RowSelectionProvider>
				<SplitLayoutInner {...props} />
			</RowSelectionProvider>
		</TimelineProvider>
	);
}
