import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows, type GroupingMode } from "./group-rows";
import {
	barHeight,
	CREATE_LANE_HEIGHT,
	GROUP_PADDING,
	LANE_GAP,
	WORKLOAD_STRIP_HEIGHT,
} from "./lane-metrics";
import { type PackedBar, packLanes } from "./pack-lanes";
import { type DayLoad, dailyWorkload } from "./workload";

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
	/** Per-day scheduled effort, rendered as the band atop the row. */
	workload: DayLoad[];
	/** Number of schedulable tasks — stable across collapse (lanes are dropped). */
	taskCount: number;
	/** Collapsed rows shrink to just the workload band and hide their task bars. */
	collapsed: boolean;
};

/**
 * Stack packed lanes vertically. Each lane is sized to its tallest bar; lanes
 * are separated by LANE_GAP. A bar-free CREATE_LANE_HEIGHT strip is reserved
 * below the last lane so drag-to-create stays reachable on a packed row.
 * Returns positioned lanes plus the group's total pixel height (including
 * GROUP_PADDING top and bottom).
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
	const stackHeight = positioned.length === 0 ? 0 : top + LANE_GAP;
	return {
		lanes: positioned,
		height: stackHeight + CREATE_LANE_HEIGHT + GROUP_PADDING * 2,
	};
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
	allAssignees: TaskAssignee[] = [],
	collapsedKeys: ReadonlySet<string> = new Set(),
): { rows: SchedulerRow[]; totalHeight: number } {
	const groups = buildGroupRows(items, mode, allAssignees);
	const rows: SchedulerRow[] = [];
	let top = 0;
	for (const g of groups) {
		const collapsed = collapsedKeys.has(g.key);
		// A collapsed row drops its lanes and shrinks to just the workload band.
		const packed = collapsed ? [] : packLanes(g.tasks, today);
		const { lanes, height: stackHeight } = stackLanes(packed);
		const height = collapsed
			? WORKLOAD_STRIP_HEIGHT
			: stackHeight + WORKLOAD_STRIP_HEIGHT;
		rows.push({
			key: g.key,
			label: g.label,
			assignee: g.assignee,
			top,
			height,
			lanes,
			workload: dailyWorkload(g.tasks),
			taskCount: g.tasks.length,
			collapsed,
		});
		top += height;
	}
	return { rows, totalHeight: top };
}
