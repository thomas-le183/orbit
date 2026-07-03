import { UserAvatar } from "@orbit/ui/custom/user-avatar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { useResizeObserver } from "usehooks-ts";
import { usePreferences } from "@/hooks/use-preferences";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import { msPerViewport } from "../controller/geometry";
import CustomizeMenu from "../customize-menu";
import { useTimelineData } from "../data/context";
import TimeUnitsBar from "../header/time-units-bar";
import { useResizableDivider } from "../layout/use-resizable-divider";
import MilestoneMarkers from "../milestone-markers";
import NowLine from "../now-line";
import TimelineScrollbar from "../scrollbar";
import { RowSelectionProvider, useRowSelection } from "../selection/context";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";
import { layoutScheduler, type SchedulerRow } from "./layout";
import SchedulerLanes from "./scheduler-lanes";

const PAN_STEP = 0.25;

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

function GroupHeader({ row }: { row: SchedulerRow }) {
	return (
		<div
			data-testid="scheduler-group-header"
			className="flex items-center gap-2 border-b border-border px-3"
			style={{ height: row.height }}
		>
			<UserAvatar
				size="sm"
				colorSeed={row.assignee?.id ?? row.key}
				placeholder={row.label}
				avatarUrl={row.assignee?.avatarUrl}
			/>
			<span className="min-w-0 flex-1 truncate text-sm font-medium">
				{row.label}
			</span>
			<span className="shrink-0 text-xs text-muted-foreground">
				{row.lanes.reduce((n, lane) => n + lane.length, 0)}
			</span>
		</div>
	);
}

function SchedulerLayoutInner({ viewSwitch }: { viewSwitch?: ReactNode }) {
	const {
		setViewportWidth,
		scrollToToday,
		setOffsetMs,
		zoomLevel,
		viewportWidth,
		viewportRef,
		scrollContainerRef,
		today,
	} = useTimelineController();
	const { tableWidth, collapsed, onDividerPointerDown } = useResizableDivider();
	const { onWheel } = usePan();
	const { clear } = useRowSelection();
	const { items } = useTimelineData();

	const { rows, totalHeight } = useMemo(
		() => layoutScheduler(items, "assignee", today),
		[items, today],
	);

	const scrollRef = scrollContainerRef;
	const { width = 0 } = useResizeObserver({
		ref: viewportRef as RefObject<HTMLDivElement>,
	});
	useEffect(() => {
		setViewportWidth(width);
	}, [width, setViewportWidth]);

	const panViewports = (fraction: number) => {
		setOffsetMs(
			(prev) =>
				prev +
				fraction *
					msPerViewport({ offsetMs: prev, zoom: zoomLevel, viewportWidth }),
		);
	};
	const panRef = useRef(panViewports);
	panRef.current = panViewports;

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

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isTypingTarget(e.target)) clear();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [clear]);

	return (
		<div className="relative flex h-full flex-col" data-testid="scheduler-view">
			{/* toolbar */}
			<div className="flex items-center justify-between border-b border-border p-2">
				<div className="flex items-center gap-1.5" />
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						aria-label="Scroll to earlier dates"
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
						onClick={() => panViewports(PAN_STEP)}
						className="rounded-md border border-border p-1 hover:bg-accent"
					>
						<ChevronRight className="size-4" />
					</button>
					<ZoomControl />
					<CustomizeMenu viewSwitch={viewSwitch} />
				</div>
			</div>

			{/* split region */}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{/* header band */}
				<div className="relative z-20 flex h-12 shrink-0 border-b border-border">
					<div
						className="relative z-30 shrink-0 overflow-hidden border-r border-border bg-muted/40"
						style={{ width: collapsed ? 0 : tableWidth }}
					/>
					<div className="relative flex-1">
						<TimeUnitsBar />
					</div>
				</div>

				{/* body */}
				<div className="relative flex-1 overflow-hidden">
					<div
						className="absolute inset-y-0"
						style={{ left: collapsed ? 0 : tableWidth, right: 0 }}
					>
						<TimelineGrid />
						<NowLine />
						<MilestoneMarkers />
					</div>
					<div
						ref={scrollRef}
						className="absolute inset-0 overflow-y-auto overflow-x-hidden"
					>
						<div className="flex min-h-full">
							{!collapsed && (
								<div
									data-testid="scheduler-group-column"
									className="relative z-30 min-h-full shrink-0 overflow-hidden border-r border-border bg-background-primary"
									style={{ width: tableWidth }}
								>
									{rows.map((row) => (
										<GroupHeader key={row.key} row={row} />
									))}
								</div>
							)}
							<div
								ref={viewportRef}
								className="relative flex-1 touch-none select-none"
								onWheel={onWheel}
							>
								<SchedulerLanes rows={rows} totalHeight={totalHeight} />
							</div>
						</div>
					</div>

					{!collapsed && (
						<div
							data-testid="scheduler-split-divider"
							onPointerDown={onDividerPointerDown}
							className="absolute inset-y-0 z-40 w-3 -translate-x-1/2 cursor-col-resize hover:bg-border"
							style={{ left: tableWidth }}
						/>
					)}
				</div>

				{/* footer scrollbar */}
				<div className="flex shrink-0">
					{!collapsed && (
						<div className="shrink-0" style={{ width: tableWidth }} />
					)}
					<div className="relative flex-1">
						<TimelineScrollbar />
					</div>
				</div>
			</div>
		</div>
	);
}

export default function SchedulerLayout({
	viewSwitch,
}: {
	viewSwitch?: ReactNode;
}) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<RowSelectionProvider>
				<SchedulerLayoutInner viewSwitch={viewSwitch} />
			</RowSelectionProvider>
		</TimelineProvider>
	);
}
