import { cn } from "@orbit/shared";
import {
	Fragment,
	type PointerEvent as ReactPointerEvent,
	useRef,
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
import { barHeight, GROUP_PADDING } from "./lane-metrics";
import type { SchedulerRow } from "./layout";
import type { DragRole } from "./use-bar-drag";
import type { LaneCreateDraft } from "./use-lane-create";

/** Horizontal gap trimmed off each side of a bar so it reads as distinct. */
const BAR_INLINE_INSET_PX = 3;

export default function SchedulerLanes({
	rows,
	totalHeight,
	beginResize,
	beginDrag,
	dragDraft,
	wasDragged,
	beginCreate,
	createDraft,
	renamingId,
	onRename,
	clearRenaming,
}: {
	rows: SchedulerRow[];
	totalHeight: number;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number },
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
	renamingId: string | null;
	onRename: (id: string, name: string) => void;
	clearRenaming: () => void;
}) {
	const { offsetMs, zoomLevel, viewportWidth, today } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { isSelected, toggle, hoveredId, setHovered } = useRowSelection();
	const { isError } = useTimelineData();
	// Guards the rename input against committing twice: Enter/Escape commit and
	// clear, which unmounts the focused input and, in a real browser, fires a
	// native blur — this flag makes onBlur consume that unmount-blur once.
	const renameCommittedRef = useRef(false);

	if (viewportWidth <= 0) return null;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };
	const minWidthPercent = (MIN_BAR_WIDTH_PX / viewportWidth) * 100;

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
					<div
						data-testid="scheduler-create-surface"
						onPointerDown={(e) =>
							beginCreate(e, { key: row.key, assigneeId: row.assignee?.id })
						}
						className="pointer-events-auto absolute inset-x-0 cursor-crosshair border-b border-border"
						style={{ top: row.top, height: row.height }}
					/>
					{createDraft?.laneKey === row.key &&
						(() => {
							const left = getPercentageOffset(
								startOfUtcDay(Date.parse(createDraft.startDate)) - today,
							);
							const right = getPercentageOffset(
								startOfUtcDay(Date.parse(createDraft.endDate)) -
									today +
									ONE_DAY,
							);
							if (!Number.isFinite(left) || !Number.isFinite(right)) {
								return null;
							}
							return (
								<span
									data-testid="scheduler-create-preview"
									className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/60 bg-primary/15"
									style={{
										left: `${left}%`,
										width: `${Math.max(right - left, 0)}%`,
										top: row.top + ROW_PADDING,
										height: row.height - ROW_PADDING * 2,
									}}
								/>
							);
						})()}
					{dragDraft?.pointerContentY != null &&
						dragDraft.targetLaneKey === row.key && (
							<div
								data-testid="scheduler-lane-drop-target"
								className="pointer-events-none absolute inset-x-0 rounded-sm bg-primary/10 ring-1 ring-primary/40"
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
							const dragging = dragDraft?.id === item.id;
							const top =
								dragging && dragDraft?.pointerContentY != null
									? dragDraft.pointerContentY - height / 2
									: row.top + GROUP_PADDING + lane.top;
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
								<button
									type="button"
									key={item.id}
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
										"group pointer-events-auto absolute flex cursor-grab items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm",
										(selected || hovered) && "ring-2 ring-primary",
									)}
								>
									{item.progress !== undefined && (
										<span
											className="absolute inset-y-0 left-0 bg-black/20"
											style={{ width: `${item.progress}%` }}
										/>
									)}
									<span className="relative truncate">{item.name}</span>
									{item.kind === "task" && (
										<span
											data-testid="scheduler-bar-resize"
											onPointerDown={(e) => {
												e.stopPropagation();
												beginResize(e, { id: item.id, startHeight: height });
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
								</button>
							);
						}),
					)}
				</Fragment>
			))}
		</div>
	);
}
