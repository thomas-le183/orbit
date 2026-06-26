import { cn } from "@orbit/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { type Task, tasks } from "@/data/tasks";
import { useTimelineController } from "./controller/context";
import { type Geometry, rangeVisibility } from "./controller/geometry";
import { useHorizontalPercentageOffset } from "./controller/hooks";
import { ONE_DAY, startOfUtcDay } from "./units/make-units";

/** Vertical pixels allotted to one task row. */
const ROW_HEIGHT = 40;
/** Vertical gap trimmed off the top/bottom of each bar within its row. */
const ROW_PADDING = 7;

/** ms-offsets-from-today for a task. End date is inclusive, so it fills its full day. */
function taskRange(task: Task, today: number): { from: number; to: number } {
	return {
		from: startOfUtcDay(Date.parse(task.startDate)) - today,
		to: startOfUtcDay(Date.parse(task.endDate)) - today + ONE_DAY,
	};
}

export default function TaskBars() {
	const { today, offsetMs, zoomLevel, viewportWidth, scrollToMs } =
		useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	const rows = useMemo(() => {
		const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };
		return tasks.map((task) => {
			const range = taskRange(task, today);
			return {
				task,
				range,
				visibility: rangeVisibility(range.from, range.to, geom),
			};
		});
	}, [today, offsetMs, zoomLevel, viewportWidth]);

	if (viewportWidth <= 0) return null;

	return (
		<div className="pointer-events-none absolute inset-0">
			{rows.map(({ task, range, visibility }, i) => {
				const top = i * ROW_HEIGHT + ROW_PADDING;
				const barHeight = ROW_HEIGHT - ROW_PADDING * 2;
				// center of the task, used by the fly-out to pan into view.
				const centerMs = (range.from + range.to) / 2;

				if (visibility !== "visible") {
					const side = visibility; // "left" | "right"
					return (
						<button
							key={task.id}
							type="button"
							data-testid={`timeline-task-flyout-${side}`}
							onClick={() => scrollToMs(centerMs)}
							title={`Jump to “${task.name}”`}
							style={{ top, height: barHeight }}
							className={cn(
								"pointer-events-auto absolute z-20 flex items-center gap-1 rounded-md border border-border bg-popover px-1.5 text-xs font-medium text-foreground shadow-md hover:bg-accent",
								side === "left" ? "left-1" : "right-1",
							)}
						>
							{side === "left" && <ChevronLeft className="size-3.5 shrink-0" />}
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: task.color }}
							/>
							<span className="max-w-28 truncate">{task.name}</span>
							{side === "right" && (
								<ChevronRight className="size-3.5 shrink-0" />
							)}
						</button>
					);
				}

				const left = getPercentageOffset(range.from);
				const right = getPercentageOffset(range.to);
				if (!Number.isFinite(left) || !Number.isFinite(right)) return null;

				return (
					<div
						key={task.id}
						data-testid="timeline-task-bar"
						title={task.name}
						style={{
							left: `${left}%`,
							width: `${Math.max(right - left, 0)}%`,
							top,
							height: barHeight,
							backgroundColor: task.color,
						}}
						className="absolute flex items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm"
					>
						{/* progress fill */}
						<span
							className="absolute inset-y-0 left-0 bg-black/20"
							style={{ width: `${task.progress}%` }}
						/>
						<span className="relative truncate">{task.name}</span>
					</div>
				);
			})}
		</div>
	);
}
