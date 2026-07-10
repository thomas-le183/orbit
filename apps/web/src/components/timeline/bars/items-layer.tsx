// apps/web/src/components/timeline/bars/items-layer.tsx
import { cn } from "@orbit/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { MIN_BAR_WIDTH_PX, RESIZE_HANDLE_MIN_BAR_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import {
	type Geometry,
	percentToMs,
	rangeVisibility,
} from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import {
	type ContainerRect,
	layoutItems,
	type RenderRow,
} from "../controller/layout";
import { useTimelineData } from "../data/context";
import { DependencyLayer } from "../dependencies/dependency-layer";
import type { Anchor } from "../dependencies/geometry";
import { DraftLane } from "../draft/draft-row";
import { useDraftTask } from "../draft/use-draft-task";
import { usePublishDragRange } from "../drag/context";
import {
	contentHeight,
	ROW_HEIGHT,
	ROW_PADDING,
	rowTop,
} from "../layout/row-metrics";
import { useVirtualRows } from "../layout/virtual-rows";
import { useRowSelection } from "../selection/context";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";
import { labelFitsInside, measureTextWidth } from "./bar-label";
import {
	type GestureTarget,
	rangeToDates,
	useBarInteraction,
} from "./use-bar-interaction";
import { dependencyType, useLinkInteraction } from "./use-link-interaction";

/** Default span (inclusive days) applied when scheduling an undated task by click. */
const DEFAULT_SCHEDULE_SPAN_DAYS = 7;

export default function ItemsLayer() {
	const { today, offsetMs, zoomLevel, viewportWidth, scrollToMs } =
		useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const {
		items,
		updateItem,
		moveDays,
		isError,
		undatedTaskRows,
		scheduleTask,
		createDependency,
		dependencies,
	} = useTimelineData();

	const { rows, containers } = useMemo(
		() => layoutItems(items, today),
		[items, today],
	);

	const { isSelected, hoveredId, setHovered } = useRowSelection();
	const { isVisible, isSpanVisible } = useVirtualRows();
	const { enabled: draftEnabled } = useDraftTask();
	const draftIndex = rows.length + undatedTaskRows.length;

	// Ghost bar shown while hovering an undated lane: the span a click would create.
	const [schedulePreview, setSchedulePreview] = useState<{
		id: string;
		left: number;
		width: number;
	} | null>(null);

	const { draft, active, pointer, beginGesture } = useBarInteraction({
		onCommitMove: (id, days) => moveDays(id, days),
		onCommitResize: (id, range) =>
			updateItem(id, rangeToDatesPatch(range, today)),
	});

	const { linkDraft, beginLink } = useLinkInteraction({
		onCreate: (from, to) => {
			// A pair of tasks may have only one dependency between them (either
			// direction), matching the API rule — skip a link that would duplicate it.
			const alreadyLinked = dependencies.some(
				(d) =>
					(d.predecessorId === from.taskId && d.successorId === to.taskId) ||
					(d.predecessorId === to.taskId && d.successorId === from.taskId),
			);
			if (alreadyLinked) {
				toast.error("These tasks already have a dependency");
				return;
			}
			createDependency({
				predecessorId: from.taskId,
				successorId: to.taskId,
				type: dependencyType(from.anchor, to.anchor),
			});
		},
	});

	// Publish the live drag to the header so it can tint the days / pin a date
	// label above the cursor. Gated on `pointer` so a click without movement
	// (pointerdown only) never flashes feedback.
	const activeRow = active
		? rows.find((r) => r.item.id === active.id)
		: undefined;
	usePublishDragRange(
		active && pointer && activeRow
			? (draft[active.id] ?? activeRow.range)
			: null,
		pointer?.x ?? null,
	);

	if (viewportWidth <= 0) return null;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };

	// Start-of-day timestamp under the cursor within an undated lane, or null.
	const startTsFromClientX = (
		lane: HTMLElement,
		clientX: number,
	): number | null => {
		const rect = lane.getBoundingClientRect();
		if (rect.width <= 0) return null;
		const percent = ((clientX - rect.left) / rect.width) * 100;
		return startOfUtcDay(today + percentToMs(percent, geom));
	};

	// Click an undated lane to schedule the task: the clicked day becomes the
	// start, spanning a default week. The PATCH refetch moves it into `items`.
	const scheduleFromClick = (
		taskId: string,
		lane: HTMLElement,
		clientX: number,
	) => {
		const startTs = startTsFromClientX(lane, clientX);
		if (startTs === null) return;
		scheduleTask(
			taskId,
			toUtcDateString(startTs),
			toUtcDateString(startTs + (DEFAULT_SCHEDULE_SPAN_DAYS - 1) * ONE_DAY),
		);
	};

	// Update the ghost preview as the cursor moves across an undated lane.
	const previewFromMove = (
		taskId: string,
		lane: HTMLElement,
		clientX: number,
	) => {
		const startTs = startTsFromClientX(lane, clientX);
		if (startTs === null) return;
		const startOffset = startTs - today;
		const left = getPercentageOffset(startOffset);
		const right = getPercentageOffset(
			startOffset + DEFAULT_SCHEDULE_SPAN_DAYS * ONE_DAY,
		);
		setSchedulePreview({ id: taskId, left, width: right - left });
	};

	// effective range = draft override (live drag) else laid-out range
	const rangeOf = (row: RenderRow): RelativeTimeRangeOffset =>
		draft[row.item.id] ?? row.range;

	const descendantsOf = (parentId: string): string[] =>
		rows
			.filter((r) => r.item.parentId === parentId && !r.isParent)
			.map((r) => r.item.id);

	return (
		<div
			data-testid="timeline-items-content"
			className="pointer-events-none relative w-full"
			style={{
				height: contentHeight(
					rows.length + undatedTaskRows.length + (draftEnabled ? 1 : 0),
				),
			}}
		>
			{isError && (
				<div
					data-testid="timeline-items-error"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					Couldn't load tasks
				</div>
			)}
			{/* per-row lanes (behind bars): capture hover anywhere on the row and
			    render the selection/hover highlight */}
			{rows.map((row) => {
				if (!isVisible(row.rowIndex)) return null;
				const selected = isSelected(row.item.id);
				const hovered = hoveredId === row.item.id;
				return (
					<div
						key={`lane-${row.item.id}`}
						data-testid="timeline-row-lane"
						data-selected={selected}
						onMouseEnter={() => setHovered(row.item.id)}
						onMouseLeave={() => setHovered(null)}
						className={cn(
							"pointer-events-auto absolute inset-x-0",
							selected ? "bg-accent" : hovered ? "bg-muted/50" : "",
						)}
						style={{ top: row.rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
					/>
				);
			})}

			{/* clickable lanes for undated tasks: click a position to schedule the task */}
			{undatedTaskRows.map((task, i) => {
				const rowIndex = rows.length + i;
				if (!isVisible(rowIndex)) return null;
				const selected = isSelected(task.id);
				const hovered = hoveredId === task.id;
				return (
					<button
						type="button"
						key={`lane-${task.id}`}
						data-testid="timeline-undated-lane"
						data-selected={selected}
						title="Click to schedule"
						onMouseEnter={() => setHovered(task.id)}
						onMouseLeave={() => {
							setHovered(null);
							setSchedulePreview(null);
						}}
						onMouseMove={(e) =>
							previewFromMove(task.id, e.currentTarget, e.clientX)
						}
						onClick={(e) =>
							scheduleFromClick(task.id, e.currentTarget, e.clientX)
						}
						className={cn(
							"pointer-events-auto absolute inset-x-0 cursor-pointer",
							selected ? "bg-accent" : hovered ? "bg-muted/50" : "",
						)}
						style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
					>
						{schedulePreview?.id === task.id && (
							<span
								data-testid="timeline-undated-preview"
								className="pointer-events-none absolute flex items-center justify-center rounded-md border-2 border-dashed border-primary/60 bg-primary/15 text-xs font-medium text-muted-foreground"
								style={{
									left: `${schedulePreview.left}%`,
									width: `${schedulePreview.width}%`,
									top: ROW_PADDING,
									height: ROW_HEIGHT - ROW_PADDING * 2,
								}}
							>
								{task.name}
							</span>
						)}
					</button>
				);
			})}

			{/* parent container rects (behind bars) */}
			{containers.map((c: ContainerRect) => {
				if (!isSpanVisible(c.rowStart, c.rowEnd)) return null;
				const left = getPercentageOffset(c.range.from);
				const right = getPercentageOffset(c.range.to);
				if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
				return (
					<div
						key={`container-${c.parentId}`}
						data-testid="timeline-container-rect"
						className="absolute rounded-lg border border-border/60 bg-muted/40"
						style={{
							left: `${left}%`,
							width: `${Math.max(right - left, 0)}%`,
							top: c.rowStart * ROW_HEIGHT + 2,
							height: (c.rowEnd - c.rowStart + 1) * ROW_HEIGHT - 4,
						}}
					/>
				);
			})}

			{/* rows */}
			{rows.map((row) => {
				if (!isVisible(row.rowIndex)) return null;
				const range = rangeOf(row);
				const top = rowTop(row.rowIndex);
				const barHeight = ROW_HEIGHT - ROW_PADDING * 2;
				const centerMs = (range.from + range.to) / 2;
				const visibility = rangeVisibility(range.from, range.to, geom);
				const { item } = row;

				if (visibility !== "visible") {
					const side = visibility;
					return (
						<button
							key={item.id}
							type="button"
							data-testid={`timeline-item-flyout-${side}`}
							onClick={() => scrollToMs(centerMs)}
							title={`Jump to "${item.name}"`}
							style={{ top, height: barHeight }}
							className={cn(
								"pointer-events-auto absolute z-20 flex items-center gap-1 rounded-md border border-border bg-popover px-1.5 text-xs font-medium text-foreground shadow-md hover:bg-accent",
								side === "left" ? "left-1" : "right-1",
							)}
						>
							{side === "left" && <ChevronLeft className="size-3.5 shrink-0" />}
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span className="max-w-28 truncate">{item.name}</span>
							{side === "right" && (
								<ChevronRight className="size-3.5 shrink-0" />
							)}
						</button>
					);
				}

				const left = getPercentageOffset(range.from);

				// Milestone: a diamond marker centered in its day (centerMs = range.from + ½ day).
				if (item.kind === "milestone") {
					const markerLeft = getPercentageOffset(centerMs);
					if (!Number.isFinite(markerLeft)) return null;
					const moveTarget: GestureTarget = {
						role: "move",
						id: item.id,
						range,
						descendantIds: [],
					};
					return (
						<Fragment key={item.id}>
							<div
								data-testid="timeline-milestone"
								title={item.name}
								onPointerDown={(e) => beginGesture(e, moveTarget)}
								onMouseEnter={() => setHovered(item.id)}
								onMouseLeave={() => setHovered(null)}
								style={{ left: `${markerLeft}%`, top: top + barHeight / 2 }}
								className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 size-3 rotate-45 cursor-grab rounded-[2px] active:cursor-grabbing"
							>
								<span
									className="block size-full rotate-45"
									style={{ backgroundColor: item.color }}
								/>
							</div>
							<span
								data-testid="timeline-milestone-label"
								className="pointer-events-none absolute z-10 flex items-center whitespace-nowrap pl-2.5 text-xs font-medium text-foreground"
								style={{ left: `${markerLeft}%`, top, height: barHeight }}
							>
								{item.name}
							</span>
						</Fragment>
					);
				}

				const right = getPercentageOffset(range.to);
				if (!Number.isFinite(left) || !Number.isFinite(right)) return null;

				const moveTarget: GestureTarget = {
					role: "move",
					id: item.id,
					range,
					descendantIds: row.isParent ? descendantsOf(item.id) : [],
				};

				// At far-out zooms a short task collapses to a sub-pixel sliver. Floor
				// the rendered width so every bar stays visible and grabbable.
				// `effectiveRight` is the bar's right edge after that floor — reused for
				// the outside label and finish link node so they track the visible bar.
				const minWidthPercent = (MIN_BAR_WIDTH_PX / viewportWidth) * 100;
				const effectiveRight = Math.max(right, left + minWidthPercent);
				const barWidthPx = ((effectiveRight - left) / 100) * viewportWidth;

				// When the name is wider than the bar, render it beside the bar
				// instead of clipping it inside.
				const fitsInside = labelFitsInside(
					barWidthPx,
					measureTextWidth(item.name),
				);
				// Once the bar is too narrow to hold both resize handles plus a move
				// zone, drop the handles so they don't overlap and swallow the move area.
				const showResizeHandles =
					!row.isParent && barWidthPx >= RESIZE_HANDLE_MIN_BAR_PX;

				return (
					<Fragment key={item.id}>
						<div
							data-testid="timeline-task-bar"
							title={item.name}
							onPointerDown={(e) => beginGesture(e, moveTarget)}
							onMouseEnter={() => setHovered(item.id)}
							onMouseLeave={() => setHovered(null)}
							style={{
								left: `${left}%`,
								width: `${effectiveRight - left}%`,
								top,
								height: barHeight,
								backgroundColor: row.isParent ? "transparent" : item.color,
								borderColor: item.color,
							}}
							className={cn(
								"pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 text-xs font-medium shadow-sm",
								row.isParent
									? "cursor-grab border-2 active:cursor-grabbing"
									: "cursor-grab text-white active:cursor-grabbing",
							)}
						>
							{!row.isParent && item.progress !== undefined && (
								<span
									className="absolute inset-y-0 left-0 bg-black/20"
									style={{ width: `${item.progress}%` }}
								/>
							)}
							{fitsInside && (
								<span
									className={cn(
										"relative truncate",
										row.isParent && "text-foreground",
									)}
								>
									{item.name}
								</span>
							)}

							{/* resize handles (leaf tasks only, wide enough to hold them) */}
							{showResizeHandles && (
								<>
									<span
										data-testid="timeline-resize-start"
										onPointerDown={(e) =>
											beginGesture(e, {
												role: "resize-start",
												id: item.id,
												range,
												descendantIds: [],
											})
										}
										className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
									/>
									<span
										data-testid="timeline-resize-end"
										onPointerDown={(e) =>
											beginGesture(e, {
												role: "resize-end",
												id: item.id,
												range,
												descendantIds: [],
											})
										}
										className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
									/>
								</>
							)}
						</div>

						{!fitsInside && (
							<span
								data-testid="timeline-task-label-outside"
								className="pointer-events-none absolute z-10 flex items-center whitespace-nowrap pl-1.5 text-xs font-medium text-foreground"
								style={{ left: `${effectiveRight}%`, top, height: barHeight }}
							>
								{item.name}
							</span>
						)}

						{!row.isParent &&
							(
								[
									// Each node is a transparent hit ZONE that sits just outside its
									// bar end and bridges the gap back to the bar edge, with the
									// visible dot at the outer end (clear of the inner resize
									// handle). The bridge keeps the node hoverable with no dead gap.
									// [anchor, xPercent, zoneTransform, dotAlign]
									["start", left, "translate(-100%, -50%)", "justify-start"],
									[
										"finish",
										effectiveRight,
										"translate(0%, -50%)",
										"justify-end",
									],
								] as [Anchor, number, string, string][]
							).map(([anchor, xPercent, transform, dotAlign]) => {
								// The node the cursor is dragging over → highlight the drop target.
								const isDropTarget =
									linkDraft?.over?.taskId === item.id &&
									linkDraft.over.anchor === anchor;
								return (
									<span
										key={anchor}
										data-testid="timeline-link-node"
										data-link-target={item.id}
										data-link-anchor={anchor}
										onPointerDown={(e) =>
											beginLink(e, { taskId: item.id, anchor })
										}
										// Keep the node visible while the pointer is anywhere on the
										// zone (bar → bridge → dot), not just while the bar is hovered.
										onMouseEnter={() => setHovered(item.id)}
										style={{
											left: `${xPercent}%`,
											top: top + barHeight / 2,
											transform,
										}}
										className={cn(
											"group absolute z-20 flex h-4 w-5 cursor-crosshair items-center",
											dotAlign,
											hoveredId === item.id || linkDraft
												? "pointer-events-auto opacity-100"
												: "pointer-events-none opacity-0",
										)}
									>
										<span
											className={cn(
												"size-3.5 rounded-full border-2 border-primary shadow-sm transition-shadow group-hover:ring-2 group-hover:ring-primary/40",
												isDropTarget
													? "bg-primary ring-2 ring-primary/50"
													: "bg-background",
											)}
										/>
									</span>
								);
							})}
					</Fragment>
				);
			})}

			{draftEnabled && isVisible(draftIndex) && (
				<DraftLane rowIndex={draftIndex} />
			)}

			<DependencyLayer draft={draft} linkDraft={linkDraft} />
		</div>
	);
}

/** Adapt rangeToDates into an updateItem patch. */
function rangeToDatesPatch(range: RelativeTimeRangeOffset, today: number) {
	const { startDate, endDate } = rangeToDates(range, today);
	return { startDate, endDate };
}
