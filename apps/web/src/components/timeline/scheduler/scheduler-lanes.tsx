import { cn } from "@orbit/shared";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MIN_BAR_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { type Geometry, rangeVisibility } from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { useTimelineData } from "../data/context";
import { useRowSelection } from "../selection/context";
import { barHeight, GROUP_PADDING } from "./lane-metrics";
import type { SchedulerRow } from "./layout";

export default function SchedulerLanes({
	rows,
	totalHeight,
	beginResize,
}: {
	rows: SchedulerRow[];
	totalHeight: number;
	beginResize: (
		e: ReactPointerEvent,
		target: { id: string; startHeight: number },
	) => void;
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
			{rows.map((row) =>
				row.lanes.map((lane) =>
					lane.bars.map(({ item, range }) => {
						if (rangeVisibility(range.from, range.to, geom) !== "visible") {
							return null;
						}
						const left = getPercentageOffset(range.from);
						const right = getPercentageOffset(range.to);
						if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
						const width = Math.max(right - left, minWidthPercent);
						const top = row.top + GROUP_PADDING + lane.top;
						const height = barHeight(item);
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
								onClick={() => toggle(item.id)}
								style={{
									left: `${left}%`,
									width: `${width}%`,
									top,
									height,
									backgroundColor: item.color,
								}}
								className={cn(
									"group pointer-events-auto absolute flex items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm",
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
							</button>
						);
					}),
				),
			)}
		</div>
	);
}
