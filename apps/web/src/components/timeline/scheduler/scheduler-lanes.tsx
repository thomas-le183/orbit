import { cn } from "@orbit/shared";
import { Fragment, type PointerEvent as ReactPointerEvent } from "react";
import { MIN_BAR_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { type Geometry, rangeVisibility } from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { useTimelineData } from "../data/context";
import { useRowSelection } from "../selection/context";
import type { RelativeTimeRangeOffset } from "../units/types";
import { barHeight, GROUP_PADDING } from "./lane-metrics";
import type { SchedulerRow } from "./layout";
import type { DragRole } from "./use-bar-drag";

/** Horizontal gap trimmed off each side of a bar so it reads as distinct. */
const BAR_INLINE_INSET_PX = 3;

export default function SchedulerLanes({
	rows,
	totalHeight,
	beginResize,
	beginDrag,
	dragDraft,
	wasDragged,
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
}) {
	const { offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { isSelected, toggle, hoveredId, setHovered } = useRowSelection();
	const { isError } = useTimelineData();

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
							if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
							const width = Math.max(right - left, minWidthPercent);
							const height = barHeight(item);
							const dragging = dragDraft?.id === item.id;
							const top =
								dragging && dragDraft?.pointerContentY != null
									? dragDraft.pointerContentY - height / 2
									: row.top + GROUP_PADDING + lane.top;
							const selected = isSelected(item.id);
							const hovered = hoveredId === item.id;
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
