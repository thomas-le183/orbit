// apps/web/src/components/timeline/items-layer.tsx
import { cn } from "@orbit/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode, useMemo } from "react";
import { labelFitsInside, measureTextWidth } from "./bar-label";
import { useTimelineController } from "./controller/context";
import { type Geometry, rangeVisibility } from "./controller/geometry";
import { useHorizontalPercentageOffset } from "./controller/hooks";
import {
	type ContainerRect,
	layoutItems,
	type RenderRow,
} from "./controller/layout";
import { useTimelineData } from "./data/context";
import {
	contentHeight,
	ROW_HEIGHT,
	ROW_PADDING,
	rowTop,
} from "./layout/row-metrics";
import { useRowSelection } from "./selection/context";
import type { RelativeTimeRangeOffset } from "./units/types";
import {
	type GestureTarget,
	gestureTooltip,
	rangeToDates,
	useBarInteraction,
} from "./use-bar-interaction";

export default function ItemsLayer() {
	const { today, offsetMs, zoomLevel, viewportWidth, scrollToMs } =
		useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { items, updateItem, moveDays, isError, undatedTaskRows } =
		useTimelineData();

	const { rows, containers } = useMemo(
		() => layoutItems(items, today),
		[items, today],
	);

	const { isSelected, hoveredId, setHovered } = useRowSelection();

	const { draft, active, pointer, beginGesture } = useBarInteraction({
		onCommitMove: (id, days) => moveDays(id, days),
		onCommitResize: (id, range) =>
			updateItem(id, rangeToDatesPatch(range, today)),
	});

	if (viewportWidth <= 0) return null;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };

	// effective range = draft override (live drag) else laid-out range
	const rangeOf = (row: RenderRow): RelativeTimeRangeOffset =>
		draft[row.item.id] ?? row.range;

	const descendantsOf = (parentId: string): string[] =>
		rows
			.filter((r) => r.item.parentId === parentId && !r.isParent)
			.map((r) => r.item.id);

	// Date tooltip that follows the cursor during a drag/resize gesture.
	let dragTooltip: ReactNode = null;
	if (active && pointer) {
		const row = rows.find((r) => r.item.id === active.id);
		if (row) {
			const range = draft[active.id] ?? row.range;
			const tip = gestureTooltip(active.role, range, today);
			dragTooltip = (
				<div
					data-testid="timeline-drag-tooltip"
					className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium text-background shadow-md"
					style={{ left: pointer.x, top: pointer.y - 12 }}
				>
					{tip.label}
				</div>
			);
		}
	}

	return (
		<div
			data-testid="timeline-items-content"
			className="pointer-events-none relative w-full"
			style={{ height: contentHeight(rows.length) }}
		>
			{isError && (
				<div
					data-testid="timeline-items-error"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					Couldn't load tasks
				</div>
			)}
			{undatedTaskRows.length > 0 && (
				<div
					data-testid="timeline-items-unscheduled"
					className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-muted-foreground"
				>
					{undatedTaskRows.length} unscheduled task
					{undatedTaskRows.length === 1 ? "" : "s"}
				</div>
			)}
			{/* per-row lanes (behind bars): capture hover anywhere on the row and
			    render the selection/hover highlight */}
			{rows.map((row) => {
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

			{/* parent container rects (behind bars) */}
			{containers.map((c: ContainerRect) => {
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

				// When the name is wider than the bar, render it beside the bar
				// instead of clipping it inside.
				const barWidthPx = ((right - left) / 100) * viewportWidth;
				const fitsInside = labelFitsInside(
					barWidthPx,
					measureTextWidth(item.name),
				);

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
								width: `${Math.max(right - left, 0)}%`,
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

							{/* resize handles (leaf tasks only) */}
							{!row.isParent && (
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
								style={{ left: `${right}%`, top, height: barHeight }}
							>
								{item.name}
							</span>
						)}
					</Fragment>
				);
			})}

			{dragTooltip}
		</div>
	);
}

/** Adapt rangeToDates into an updateItem patch. */
function rangeToDatesPatch(range: RelativeTimeRangeOffset, today: number) {
	const { startDate, endDate } = rangeToDates(range, today);
	return { startDate, endDate };
}
