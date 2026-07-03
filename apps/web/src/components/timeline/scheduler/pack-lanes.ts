import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";

export type PackedBar = {
	item: TimelineItem;
	range: RelativeTimeRangeOffset;
};

/** Own dates as an end-inclusive ms range relative to `today` (matches ownRange). */
function ownRange(item: TimelineItem, today: number): RelativeTimeRangeOffset {
	return {
		from: startOfUtcDay(Date.parse(item.startDate)) - today,
		to: startOfUtcDay(Date.parse(item.endDate)) - today + ONE_DAY,
	};
}

/**
 * Greedy interval packing. Tasks are sorted by start, then each is placed in the
 * first lane whose last bar ends on or before this bar's start; otherwise a new
 * lane opens. Bars within a lane never overlap.
 */
export function packLanes(
	tasks: TimelineItem[],
	today: number,
): PackedBar[][] {
	const bars: PackedBar[] = tasks
		.map((item) => ({ item, range: ownRange(item, today) }))
		.sort((a, b) => a.range.from - b.range.from);

	const lanes: PackedBar[][] = [];
	const laneEnds: number[] = [];

	for (const b of bars) {
		let placed = false;
		for (let i = 0; i < lanes.length; i++) {
			if (laneEnds[i] <= b.range.from) {
				lanes[i].push(b);
				laneEnds[i] = b.range.to;
				placed = true;
				break;
			}
		}
		if (!placed) {
			lanes.push([b]);
			laneEnds.push(b.range.to);
		}
	}

	return lanes;
}
