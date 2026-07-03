import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows, type GroupingMode } from "./group-rows";
import { barHeight, GROUP_PADDING, LANE_GAP, MIN_BAR_HEIGHT } from "./lane-metrics";
import { type PackedBar, packLanes } from "./pack-lanes";

export type PositionedLane = {
	bars: PackedBar[];
	/** Cumulative pixel offset from the start of the lane stack (after GROUP_PADDING). */
	top: number;
	/** Lane height = tallest bar in the lane. */
	height: number;
};

export type SchedulerRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	top: number;
	height: number;
	lanes: PositionedLane[];
};

/**
 * Stack packed lanes vertically. Each lane is sized to its tallest bar; lanes
 * are separated by LANE_GAP. Returns positioned lanes plus the group's total
 * pixel height (including GROUP_PADDING top and bottom).
 */
export function stackLanes(lanes: PackedBar[][]): {
	lanes: PositionedLane[];
	height: number;
} {
	let top = 0;
	const positioned: PositionedLane[] = lanes.map((bars, i) => {
		const laneHeight = Math.max(...bars.map((b) => barHeight(b.item)));
		const lane: PositionedLane = { bars, top, height: laneHeight };
		top += laneHeight;
		if (i < lanes.length - 1) top += LANE_GAP;
		return lane;
	});
	const stackHeight = positioned.length === 0 ? MIN_BAR_HEIGHT : top;
	return { lanes: positioned, height: stackHeight + GROUP_PADDING * 2 };
}

/**
 * Compose grouping + lane packing + variable-height stacking into positioned
 * rows. `top` is the cumulative pixel offset of each row; `totalHeight` is the
 * full stacked height for the scroll container.
 */
export function layoutScheduler(
	items: TimelineItem[],
	mode: GroupingMode,
	today: number,
): { rows: SchedulerRow[]; totalHeight: number } {
	const groups = buildGroupRows(items, mode);
	const rows: SchedulerRow[] = [];
	let top = 0;
	for (const g of groups) {
		const packed = packLanes(g.tasks, today);
		const { lanes, height } = stackLanes(packed);
		rows.push({
			key: g.key,
			label: g.label,
			assignee: g.assignee,
			top,
			height,
			lanes,
		});
		top += height;
	}
	return { rows, totalHeight: top };
}
