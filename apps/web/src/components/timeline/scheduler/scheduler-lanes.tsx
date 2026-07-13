import { cn } from "@orbit/shared";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@orbit/ui/components/hover-card";
import {
	Fragment,
	type PointerEvent as ReactPointerEvent,
	useRef,
	useState,
} from "react";
import { MIN_BAR_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { type Geometry, rangeVisibility } from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { useTimelineData } from "../data/context";
import { ROW_PADDING } from "../layout/row-metrics";
import { useRowSelection } from "../selection/context";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";
import {
	barHeight,
	GROUP_PADDING,
	WORKLOAD_STRIP_HEIGHT,
} from "./lane-metrics";
import type { SchedulerRow } from "./layout";
import TaskHoverCard from "./task-hover-card";
import type { DragRole } from "./use-bar-drag";
import type { LaneCreateDraft } from "./use-lane-create";
import type { UnplannedDropDraft } from "./use-unplanned-drag";
import { formatWorkload, spanDays } from "./workload";
import WorkloadStrip from "./workload-strip";

/** Horizontal gap trimmed off each side of a bar so it reads as distinct. */
const BAR_INLINE_INSET_PX = 3;
/**
 * Below this bar height there isn't room to stack the title over the hours, so
 * the label collapses into a single truncating row (title + hours inline).
 */
const BAR_STACKED_MIN_HEIGHT = 32;

export default function SchedulerLanes({
	rows,
	totalHeight,
	beginResize,
	beginDrag,
	dragDraft,
	wasDragged,
	beginCreate,
	createDraft,
	dropDraft,
	renamingId,
	onRename,
	clearRenaming,
	interacting,
}: {
	rows: SchedulerRow[];
	totalHeight: number;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number; days: number },
	) => void;
	beginDrag: (
		e: ReactPointerEvent,
		target: {
			id: string;
			role: DragRole;
			range: RelativeTimeRangeOffset;
			laneKey?: string;
		},
	) => void;
	dragDraft: {
		id: string;
		range: RelativeTimeRangeOffset;
		targetLaneKey?: string | null;
		pointerContentY?: number;
	} | null;
	wasDragged: () => boolean;
	beginCreate: (
		e: ReactPointerEvent,
		row: { key: string; assigneeId?: string },
	) => void;
	createDraft: LaneCreateDraft | null;
	dropDraft: UnplannedDropDraft | null;
	renamingId: string | null;
	onRename: (id: string, name: string) => void;
	clearRenaming: () => void;
	/** True while any pointer gesture is live; suppresses hover cards. */
	interacting: boolean;
}) {
	const { offsetMs, zoomLevel, viewportWidth, today } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { isSelected, toggle, hoveredId, setHovered } = useRowSelection();
	const { isError } = useTimelineData();
	// Guards the rename input against committing twice: Enter/Escape commit and
	// clear, which unmounts the focused input and, in a real browser, fires a
	// native blur — this flag makes onBlur consume that unmount-blur once.
	const renameCommittedRef = useRef(false);
	// Which bar's hover card is open. Controlled so we can force it shut the
	// moment a drag/resize/create gesture starts (`interacting`).
	const [hoverCardId, setHoverCardId] = useState<string | null>(null);

	if (viewportWidth <= 0) return null;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };
	const minWidthPercent = (MIN_BAR_WIDTH_PX / viewportWidth) * 100;

	/** Horizontal bounds (viewport %) of an inclusive UTC day range, if on-screen. */
	const rangeBounds = (
		startDate: string,
		endDate: string,
	): { left: number; width: number } | null => {
		const left = getPercentageOffset(
			startOfUtcDay(Date.parse(startDate)) - today,
		);
		const right = getPercentageOffset(
			startOfUtcDay(Date.parse(endDate)) - today + ONE_DAY,
		);
		if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
		return { left, width: Math.max(right - left, 0) };
	};

	return (
		<div
			data-testid="scheduler-lanes"
			className="pointer-events-none relative w-full"
			style={{ height: totalHeight }}
		>
			{isError && (
				<div
					data-testid="scheduler-error"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					Couldn't load tasks
				</div>
			)}
			{rows.map((row) => (
				<Fragment key={row.key}>
					<WorkloadStrip
						row={row}
						geom={geom}
						today={today}
						getPercentageOffset={getPercentageOffset}
					/>
					<div
						data-testid="scheduler-create-surface"
						onPointerDown={(e) =>
							beginCreate(e, { key: row.key, assigneeId: row.assignee?.id })
						}
						className="pointer-events-auto absolute inset-x-0 border-b border-border"
						style={{
							top: row.top + WORKLOAD_STRIP_HEIGHT,
							height: row.height - WORKLOAD_STRIP_HEIGHT,
						}}
					/>
					{createDraft?.laneKey === row.key &&
						(() => {
							const bounds = rangeBounds(
								createDraft.startDate,
								createDraft.endDate,
							);
							if (!bounds) return null;
							return (
								<span
									data-testid="scheduler-create-preview"
									className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/60 bg-primary/15"
									style={{
										left: `${bounds.left}%`,
										width: `${bounds.width}%`,
										top: row.top + WORKLOAD_STRIP_HEIGHT + ROW_PADDING,
										height:
											row.height - WORKLOAD_STRIP_HEIGHT - ROW_PADDING * 2,
									}}
								/>
							);
						})()}
					{dropDraft?.laneKey === row.key && (
						<div
							data-testid="scheduler-drop-lane"
							className="pointer-events-none absolute inset-x-0 rounded-sm ring-2 ring-inset ring-primary/60"
							style={{ top: row.top, height: row.height }}
						/>
					)}
					{dropDraft?.laneKey === row.key &&
						(() => {
							const bounds = rangeBounds(
								dropDraft.startDate,
								dropDraft.endDate,
							);
							if (!bounds) return null;
							return (
								<span
									data-testid="scheduler-drop-preview"
									className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary bg-primary/25"
									style={{
										left: `${bounds.left}%`,
										width: `${bounds.width}%`,
										top: row.top + WORKLOAD_STRIP_HEIGHT + ROW_PADDING,
										height:
											row.height - WORKLOAD_STRIP_HEIGHT - ROW_PADDING * 2,
									}}
								/>
							);
						})()}
					{dragDraft?.pointerContentY != null &&
						dragDraft.targetLaneKey === row.key && (
							<div
								data-testid="scheduler-lane-drop-target"
								className="pointer-events-none absolute inset-x-0 rounded-sm ring-2 ring-inset ring-primary/60"
								style={{ top: row.top, height: row.height }}
							/>
						)}
					{row.lanes.map((lane) =>
						lane.bars.map(({ item, range: ownRange }) => {
							const range =
								dragDraft?.id === item.id ? dragDraft.range : ownRange;
							if (rangeVisibility(range.from, range.to, geom) !== "visible") {
								return null;
							}
							const left = getPercentageOffset(range.from);
							const right = getPercentageOffset(range.to);
							if (!Number.isFinite(left) || !Number.isFinite(right))
								return null;
							const width = Math.max(right - left, minWidthPercent);
							const height = barHeight(item);
							const days = spanDays(item.startDate, item.endDate);
							// The bar height encodes per-day effort, so its label shows the
							// same figure (total lives in the hover card).
							const perDayMinutes =
								item.estimatedTime != null ? item.estimatedTime / days : null;
							const dragging = dragDraft?.id === item.id;
							const top =
								dragging && dragDraft?.pointerContentY != null
									? dragDraft.pointerContentY - height / 2
									: row.top + WORKLOAD_STRIP_HEIGHT + GROUP_PADDING + lane.top;
							const selected = isSelected(item.id);
							const hovered = hoveredId === item.id;
							if (renamingId === item.id) {
								return (
									<div
										key={item.id}
										data-testid="scheduler-bar-renaming"
										style={{
											left: `calc(${left}% + ${BAR_INLINE_INSET_PX}px)`,
											width: `calc(${width}% - ${BAR_INLINE_INSET_PX * 2}px)`,
											top,
											height,
											backgroundColor: item.color,
										}}
										className="pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 shadow-sm ring-2 ring-primary"
										onPointerDown={(e) => e.stopPropagation()}
									>
										<input
											data-testid="scheduler-bar-rename-input"
											aria-label="Rename task"
											defaultValue={item.name}
											autoFocus
											onFocus={(e) => {
												// Reset the commit guard on each fresh focus so a
												// missed unmount-blur can't leave it stuck true and
												// swallow the next rename's blur-commit.
												renameCommittedRef.current = false;
												e.currentTarget.select();
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													renameCommittedRef.current = true;
													const v = e.currentTarget.value.trim();
													if (v && v !== item.name) onRename(item.id, v);
													clearRenaming();
												} else if (e.key === "Escape") {
													e.preventDefault();
													renameCommittedRef.current = true;
													clearRenaming();
												}
											}}
											onBlur={(e) => {
												// Consume the unmount-blur fired right after an
												// Enter/Escape commit so we don't rename twice.
												if (renameCommittedRef.current) {
													renameCommittedRef.current = false;
													return;
												}
												const v = e.currentTarget.value.trim();
												if (v && v !== item.name) onRename(item.id, v);
												clearRenaming();
											}}
											className="w-full bg-transparent text-xs font-medium text-white outline-none placeholder:text-white/70"
										/>
									</div>
								);
							}
							return (
								<HoverCard
									key={item.id}
									open={hoverCardId === item.id && !interacting}
									onOpenChange={(open) => setHoverCardId(open ? item.id : null)}
								>
									<HoverCardTrigger
										render={
											<button
												type="button"
												data-testid="scheduler-bar"
												data-selected={selected}
												title={item.name}
												onMouseEnter={() => setHovered(item.id)}
												onMouseLeave={() => setHovered(null)}
												onClick={() => {
													if (wasDragged()) return;
													toggle(item.id);
												}}
												onPointerDown={(e) =>
													beginDrag(e, {
														id: item.id,
														role: "move",
														range,
														laneKey: row.key,
													})
												}
												style={{
													left: `calc(${left}% + ${BAR_INLINE_INSET_PX}px)`,
													width: `calc(${width}% - ${BAR_INLINE_INSET_PX * 2}px)`,
													top,
													height,
													backgroundColor: item.color,
												}}
												className={cn(
													"group pointer-events-auto absolute flex cursor-grab overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm",
													height >= BAR_STACKED_MIN_HEIGHT
														? "flex-col justify-between py-0.5"
														: "items-center gap-1",
													(selected || hovered) && "ring-2 ring-primary",
												)}
											/>
										}
									>
										{item.progress !== undefined && (
											<span
												className="absolute inset-y-0 left-0 bg-black/20"
												style={{ width: `${item.progress}%` }}
											/>
										)}
										<span
											className={cn(
												"relative truncate text-left leading-tight",
												height >= BAR_STACKED_MIN_HEIGHT
													? "w-full"
													: "min-w-0 flex-1",
											)}
										>
											{item.name}
										</span>
										{perDayMinutes != null && (
											<span
												className={cn(
													"relative font-normal text-[10px] text-white/80",
													height >= BAR_STACKED_MIN_HEIGHT
														? "self-end leading-none"
														: "shrink-0",
												)}
											>
												{formatWorkload(perDayMinutes)}/day
											</span>
										)}
										{item.kind === "task" && (
											<span
												data-testid="scheduler-bar-resize"
												onPointerDown={(e) => {
													e.stopPropagation();
													beginResize(e, {
														id: item.id,
														startHeight: height,
														days,
													});
												}}
												className="pointer-events-auto absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
											/>
										)}
										{item.kind === "task" && (
											<>
												<span
													data-testid="scheduler-bar-resize-start"
													onPointerDown={(e) => {
														e.stopPropagation();
														beginDrag(e, {
															id: item.id,
															role: "resize-start",
															range,
														});
													}}
													className="pointer-events-auto absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
												/>
												<span
													data-testid="scheduler-bar-resize-end"
													onPointerDown={(e) => {
														e.stopPropagation();
														beginDrag(e, {
															id: item.id,
															role: "resize-end",
															range,
														});
													}}
													className="pointer-events-auto absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
												/>
											</>
										)}
									</HoverCardTrigger>
									<HoverCardContent side="top" align="start">
										<TaskHoverCard item={item} />
									</HoverCardContent>
								</HoverCard>
							);
						}),
					)}
				</Fragment>
			))}
		</div>
	);
}
