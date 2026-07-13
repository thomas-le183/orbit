import { cn } from "@orbit/shared";
import { type Geometry, rangeVisibility } from "../controller/geometry";
import { ONE_DAY } from "../units/make-units";
import { WORKLOAD_STRIP_HEIGHT } from "./lane-metrics";
import type { SchedulerRow } from "./layout";
import {
	capacityRatio,
	type DayLoad,
	formatDayLoad,
	formatWorkload,
	taskCountRatio,
	type WorkloadMetric,
} from "./workload";

/** Vertical padding inside the band so fills don't touch the row borders. */
const STRIP_INSET_PX = 4;
/** Fills never render thinner than this, so a light day is still visible. */
const MIN_FILL_PX = 2;
/**
 * A day cell narrower than this (px) has no room for its value text, so the
 * number is dropped and only the fill bar shows — the tooltip still has both.
 */
const MIN_LABEL_WIDTH_PX = 18;

/**
 * A day's fill fraction, over-capacity flag, and short on-cell value under the
 * active metric. In "hours" mode this is scheduled effort vs. the daily capacity
 * ("6h"); in "count" mode it is the task count vs. the fixed task capacity
 * ("4"). `empty` days have nothing to show for this metric and are skipped. The
 * tooltip is metric-independent (it reports both) and lives on the cell.
 */
function dayMetric(
	load: DayLoad,
	mode: WorkloadMetric,
): { ratio: number; overloaded: boolean; value: string; empty: boolean } {
	if (mode === "count") {
		const ratio = taskCountRatio(load.count);
		return {
			ratio,
			overloaded: ratio > 1,
			value: `${load.count}`,
			empty: load.count === 0,
		};
	}
	const ratio = capacityRatio(load.minutes, load.dayMs);
	return {
		ratio,
		overloaded: ratio > 1,
		value: formatWorkload(load.minutes),
		empty: load.minutes <= 0,
	};
}

/**
 * Per-day workload band drawn across the top of an assignee row, aligned to the
 * timeline's day grid. Each day's fill height is its scheduled load relative to
 * the assignee's daily capacity for the active `mode` (effort vs. hours, or task
 * count vs. a fixed task capacity); days over capacity are clamped to full
 * height and tinted as overloaded. Purely presentational and non-interactive —
 * it sits above the lanes, which start below the band.
 */
export default function WorkloadStrip({
	row,
	geom,
	today,
	mode,
	getPercentageOffset,
}: {
	row: SchedulerRow;
	geom: Geometry;
	today: number;
	mode: WorkloadMetric;
	getPercentageOffset: (ms: number) => number;
}) {
	const innerHeight = WORKLOAD_STRIP_HEIGHT - STRIP_INSET_PX * 2;

	// Nothing to show for this metric (no tasks, or in hours mode none with an
	// estimate): keep the band as a quiet empty capacity track, not blank space.
	if (!row.workload.some((load) => !dayMetric(load, mode).empty)) {
		return (
			<div
				data-testid="workload-strip-empty"
				className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
				style={{ top: row.top + STRIP_INSET_PX, height: innerHeight }}
			>
				<span className="absolute inset-x-2 bottom-0 border-border border-b border-dashed" />
				<span className="rounded-sm bg-background-primary px-1 text-[10px] font-medium text-muted-foreground/60">
					{mode === "count" ? "No tasks" : "No workload"}
				</span>
			</div>
		);
	}

	const cell = (load: DayLoad) => {
		const { ratio, overloaded, value, empty } = dayMetric(load, mode);
		if (empty) return null;
		const from = load.dayMs - today;
		const to = from + ONE_DAY;
		if (rangeVisibility(from, to, geom) !== "visible") return null;
		const left = getPercentageOffset(from);
		const right = getPercentageOffset(to);
		if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
		const fill = Math.max(MIN_FILL_PX, Math.min(ratio, 1) * innerHeight);
		// The day column's on-screen width decides whether its value text fits.
		const widthPx = ((right - left) / 100) * geom.viewportWidth;
		const showValue = widthPx >= MIN_LABEL_WIDTH_PX;
		return (
			<span
				key={load.dayMs}
				data-testid="workload-cell"
				data-overloaded={overloaded}
				title={formatDayLoad(load)}
				className="absolute bottom-0 flex items-end justify-stretch px-px"
				style={{
					left: `${left}%`,
					width: `${right - left}%`,
					height: innerHeight,
				}}
			>
				{showValue && (
					<span
						data-testid="workload-cell-value"
						className={cn(
							"absolute inset-x-0 top-0 truncate text-center text-[10px] font-semibold leading-none tabular-nums",
							overloaded ? "text-destructive" : "text-foreground",
						)}
					>
						{value}
					</span>
				)}
				<span
					className={cn(
						"w-full rounded-sm",
						overloaded ? "bg-destructive" : "bg-primary/70",
					)}
					style={{ height: fill }}
				/>
			</span>
		);
	};

	return (
		<div
			data-testid="workload-strip"
			className="pointer-events-none absolute inset-x-0"
			style={{
				top: row.top + STRIP_INSET_PX,
				height: innerHeight,
			}}
		>
			{row.workload.map(cell)}
		</div>
	);
}
