import { cn } from "@orbit/shared";
import { type Geometry, rangeVisibility } from "../controller/geometry";
import { ONE_DAY } from "../units/make-units";
import { WORKLOAD_STRIP_HEIGHT } from "./lane-metrics";
import type { SchedulerRow } from "./layout";
import { capacityRatio, type DayLoad, formatWorkload } from "./workload";

/** Vertical padding inside the band so fills don't touch the row borders. */
const STRIP_INSET_PX = 4;
/** Fills never render thinner than this, so a light day is still visible. */
const MIN_FILL_PX = 2;
/**
 * The band's full height represents this multiple of daily capacity, so a day
 * exactly at capacity fills only 1/HEADROOM of it and the capacity line has
 * headroom above it for overloaded days to visibly rise past. Days beyond this
 * multiple clamp to the top.
 */
const OVERLOAD_HEADROOM = 1.5;

/** A visible day's fill geometry, derived once and reused for cells + peak. */
type Cell = {
	load: DayLoad;
	left: number;
	right: number;
	ratio: number;
	overloaded: boolean;
};

/**
 * Per-day workload band drawn across the top of an assignee row, aligned to the
 * timeline's day grid. Each day's fill height is its scheduled effort relative
 * to the assignee's daily capacity; a faint capacity reference line marks the
 * 100%-capacity mark (with headroom above so overloaded days rise past it), and
 * the busiest visible day is labelled with its hours. Purely presentational and
 * non-interactive — it sits above the lanes, which start below the band.
 */
export default function WorkloadStrip({
	row,
	geom,
	today,
	getPercentageOffset,
}: {
	row: SchedulerRow;
	geom: Geometry;
	today: number;
	getPercentageOffset: (ms: number) => number;
}) {
	const innerHeight = WORKLOAD_STRIP_HEIGHT - STRIP_INSET_PX * 2;

	// No scheduled effort (no tasks, or none with an estimate): keep the band as
	// a quiet empty capacity track rather than leaving blank space.
	if (row.workload.length === 0) {
		return (
			<div
				data-testid="workload-strip-empty"
				className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
				style={{ top: row.top + STRIP_INSET_PX, height: innerHeight }}
			>
				<span className="absolute inset-x-2 bottom-0 border-border border-b border-dashed" />
				<span className="rounded-sm bg-background-primary px-1 text-[10px] font-medium text-muted-foreground/60">
					No workload
				</span>
			</div>
		);
	}

	// Fraction of the inner height occupied at exactly 100% capacity — the
	// capacity line sits here, measured from the bottom.
	const capacityFrac = 1 / OVERLOAD_HEADROOM;

	const cells: Cell[] = [];
	for (const load of row.workload) {
		const from = load.dayMs - today;
		const to = from + ONE_DAY;
		if (rangeVisibility(from, to, geom) !== "visible") continue;
		const left = getPercentageOffset(from);
		const right = getPercentageOffset(to);
		if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
		const ratio = capacityRatio(load.minutes, load.dayMs);
		cells.push({ load, left, right, ratio, overloaded: ratio > 1 });
	}

	// The busiest visible day, labelled with its hours as the at-a-glance metric.
	const peak = cells.reduce<Cell | null>(
		(best, c) =>
			best == null || c.load.minutes > best.load.minutes ? c : best,
		null,
	);

	return (
		<div
			data-testid="workload-strip"
			className="pointer-events-none absolute inset-x-0"
			style={{ top: row.top + STRIP_INSET_PX, height: innerHeight }}
		>
			{/* Capacity reference: a full working day sits on this line; anything
			    above it is over capacity. Weekends (zero capacity) aren't on it —
			    their bars just read as fully over. */}
			<span
				data-testid="workload-capacity-line"
				className="absolute inset-x-0 border-border border-t border-dashed"
				style={{ bottom: capacityFrac * innerHeight }}
			/>

			{cells.map(({ load, left, right, ratio, overloaded }) => {
				const fill = Math.max(
					MIN_FILL_PX,
					(Math.min(ratio, OVERLOAD_HEADROOM) / OVERLOAD_HEADROOM) *
						innerHeight,
				);
				return (
					<span
						key={load.dayMs}
						data-testid="workload-cell"
						data-overloaded={overloaded}
						title={formatWorkload(load.minutes)}
						className="absolute bottom-0 flex items-end justify-stretch px-px"
						style={{
							left: `${left}%`,
							width: `${right - left}%`,
							height: innerHeight,
						}}
					>
						<span
							className={cn(
								"w-full rounded-sm",
								overloaded ? "bg-destructive" : "bg-primary/70",
							)}
							style={{ height: fill }}
						/>
					</span>
				);
			})}

			{peak && (
				<span
					data-testid="workload-peak"
					className={cn(
						"absolute top-0 -translate-x-1/2 rounded-sm bg-background-primary px-1 text-[10px] font-medium leading-tight",
						peak.overloaded ? "text-destructive" : "text-muted-foreground",
					)}
					style={{ left: `${(peak.left + peak.right) / 2}%` }}
				>
					{formatWorkload(peak.load.minutes)}
				</span>
			)}
		</div>
	);
}
