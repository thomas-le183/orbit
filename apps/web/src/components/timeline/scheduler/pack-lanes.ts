import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";
import { barHeight, LANE_GAP } from "./lane-metrics";

export type PackedBar = {
	item: TimelineItem;
	range: RelativeTimeRangeOffset;
	/** Pixel offset of the bar's top edge from the start of the lane stack. */
	top: number;
	/** The bar's own pixel height (encodes per-day effort). */
	height: number;
};

/** Own dates as an end-inclusive ms range relative to `today` (matches ownRange). */
function ownRange(item: TimelineItem, today: number): RelativeTimeRangeOffset {
	return {
		from: startOfUtcDay(Date.parse(item.startDate)) - today,
		to: startOfUtcDay(Date.parse(item.endDate)) - today + ONE_DAY,
	};
}

/** Two ranges overlap when each starts before the other ends (touching is fine). */
function overlapsX(
	a: RelativeTimeRangeOffset,
	b: RelativeTimeRangeOffset,
): boolean {
	return a.from < b.to && b.from < a.to;
}

/**
 * Lowest top at which a bar of `height` can rest without vertically overlapping
 * any bar it collides with horizontally. Candidates are the floor (0) and just
 * below each blocker (its bottom edge + LANE_GAP); the smallest that clears all
 * blockers wins, so a bar drops into the first gap tall enough to hold it.
 */
function lowestTop(height: number, blockers: PackedBar[]): number {
	const candidates = [0, ...blockers.map((b) => b.top + b.height + LANE_GAP)];
	candidates.sort((a, b) => a - b);
	for (const top of candidates) {
		const bottom = top + height;
		const fits = blockers.every((b) => {
			// Reserve a LANE_GAP band below each blocker so neighbors never touch.
			const blockerBottom = b.top + b.height + LANE_GAP;
			return bottom <= b.top || top >= blockerBottom;
		});
		if (fits) return top;
	}
	return 0; // unreachable: the largest candidate always clears every blocker
}

/**
 * Skyline (masonry) packing. Bars are placed in start-time order; each drops to
 * the lowest vertical position where it doesn't overlap an earlier bar it shares
 * time with, resting flush (plus a LANE_GAP) on whatever sits directly beneath
 * it. Unlike fixed-height lanes, a short bar never inherits a tall neighbor's
 * height, so tasks of differing heights stack tightly on top of one another.
 * Returns the positioned bars and the total pixel height of the stack.
 */
export function packBars(
	tasks: TimelineItem[],
	today: number,
): { bars: PackedBar[]; height: number } {
	const sorted = tasks
		.map((item) => ({
			item,
			range: ownRange(item, today),
			height: barHeight(item),
			top: 0,
		}))
		.sort((a, b) => a.range.from - b.range.from || a.range.to - b.range.to);

	const bars: PackedBar[] = [];
	let bottom = 0;
	for (const bar of sorted) {
		const blockers = bars.filter((b) => overlapsX(b.range, bar.range));
		bar.top = lowestTop(bar.height, blockers);
		bars.push(bar);
		bottom = Math.max(bottom, bar.top + bar.height);
	}

	return { bars, height: bottom };
}
