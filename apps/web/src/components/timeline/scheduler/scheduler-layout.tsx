import { UserAvatar } from "@orbit/ui/custom/user-avatar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
	type ReactNode,
	type RefObject,
	useCallback,
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
import { DragRangeProvider, DragRangePublisher } from "../drag/context";
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
import { useBarDrag } from "./use-bar-drag";
import { useEstimateResize } from "./use-estimate-resize";
import { useLaneCreate } from "./use-lane-create";

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
			className="border-b border-border"
			style={{ height: row.height }}
		>
			{/* Stick the assignee to the top so it stays visible on tall rows. */}
			<div className="sticky top-0 flex items-center gap-2 bg-background-primary px-3 py-2">
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
					{row.lanes.reduce((n, lane) => n + lane.bars.length, 0)}
				</span>
			</div>
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
		offsetMs,
	} = useTimelineController();
	const { tableWidth, collapsed, onDividerPointerDown } = useResizableDivider();
	const { onWheel } = usePan();
	const { clear } = useRowSelection();
	const {
		items,
		assignees,
		updateItem,
		scheduleTask,
		setEstimate,
		createTask,
		renameTask,
	} = useTimelineData();
	const { draft, beginResize } = useEstimateResize({
		onCommit: (id, estimatedTime) => {
			updateItem(id, { estimatedTime });
			setEstimate(id, estimatedTime);
		},
	});

	const effectiveItems = useMemo(
		() =>
			draft
				? items.map((i) =>
						i.id === draft.id
							? { ...i, estimatedTime: draft.estimatedTime }
							: i,
					)
				: items,
		[items, draft],
	);

	const { rows, totalHeight } = useMemo(
		() => layoutScheduler(effectiveItems, "assignee", today, assignees),
		[effectiveItems, today, assignees],
	);

	const {
		draft: createDraft,
		beginCreate,
		renamingId,
		clearRenaming,
	} = useLaneCreate({
		geom: { offsetMs, zoom: zoomLevel, viewportWidth },
		today,
		onCreate: createTask,
	});

	const resolveLaneAt = useCallback(
		(clientY: number) => {
			const top = viewportRef.current?.getBoundingClientRect().top ?? 0;
			const contentY = clientY - top;
			const inRow = rows.find(
				(r) => contentY >= r.top && contentY < r.top + r.height,
			);
			// Clamp to first/last row so a drag past the ends still targets a lane.
			const key =
				inRow?.key ??
				(rows.length === 0
					? null
					: contentY < rows[0].top
						? rows[0].key
						: rows[rows.length - 1].key);
			return { key, contentY };
		},
		[rows, viewportRef],
	);

	const {
		draft: dragDraft,
		active: dragActive,
		pointer: dragPointer,
		beginDrag,
		wasDragged,
	} = useBarDrag({
		onCommit: (id, dates, targetLaneKey) => {
			// A lane change carries the target's assignee; fold it into the same
			// PATCH so dates + assignee update in one request.
			const assignee =
				targetLaneKey != null
					? rows.find((r) => r.key === targetLaneKey)?.assignee
					: undefined;
			updateItem(id, assignee ? { ...dates, assignee } : dates);
			scheduleTask(id, dates.startDate, dates.endDate, assignee?.id);
		},
		resolveLaneAt,
	});

	// The provider — not the header — owns the gate, so `TimeUnitsBar` only ever
	// sees a range it should highlight and needs no pointer-state knowledge.
	const headerDragRange =
		dragActive && dragPointer && dragDraft ? dragDraft.range : null;

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
		<DragRangeProvider>
			<DragRangePublisher
				range={headerDragRange}
				pointerX={dragPointer?.x ?? null}
			/>
			<div
				className="relative flex h-full flex-col"
				data-testid="scheduler-view"
			>
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
										className="relative z-30 min-h-full shrink-0 border-r border-border bg-background-primary"
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
									<SchedulerLanes
										rows={rows}
										totalHeight={totalHeight}
										beginResize={beginResize}
										beginDrag={beginDrag}
										dragDraft={dragDraft}
										dragActive={dragActive}
										dragPointer={dragPointer}
										wasDragged={wasDragged}
										beginCreate={beginCreate}
										createDraft={createDraft}
										renamingId={renamingId}
										onRename={renameTask}
										clearRenaming={clearRenaming}
									/>
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
		</DragRangeProvider>
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
