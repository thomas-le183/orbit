import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows, type GroupingMode } from "./group-rows";
import {
	CREATE_LANE_HEIGHT,
	GROUP_PADDING,
	LANE_GAP,
	WORKLOAD_STRIP_HEIGHT,
} from "./lane-metrics";
import { type PackedBar, packBars } from "./pack-lanes";
import { type DayLoad, dailyWorkload } from "./workload";

export type SchedulerRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	top: number;
	height: number;
	/** Skyline-packed bars, each carrying its own top offset and height. */
	bars: PackedBar[];
	/** Per-day scheduled effort, rendered as the band atop the row. */
	workload: DayLoad[];
	/** Number of schedulable tasks — stable across collapse (bars are dropped). */
	taskCount: number;
	/** Collapsed rows shrink to just the workload band and hide their task bars. */
	collapsed: boolean;
};

/**
 * Full pixel height of a group row's bar area: the skyline stack, a trailing
 * LANE_GAP, a bar-free CREATE_LANE_HEIGHT strip so drag-to-create stays
 * reachable on a packed row, and GROUP_PADDING top and bottom. An empty stack
 * keeps the create strip but drops the trailing gap.
 */
function groupHeight(stackHeight: number): number {
	const stack = stackHeight === 0 ? 0 : stackHeight + LANE_GAP;
	return stack + CREATE_LANE_HEIGHT + GROUP_PADDING * 2;
}

/**
 * Compose grouping + skyline bar packing into positioned rows. `top` is the
 * cumulative pixel offset of each row; `totalHeight` is the full stacked height
 * for the scroll container.
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
		// A collapsed row drops its bars and shrinks to just the workload band.
		const { bars, height: stackHeight } = collapsed
			? { bars: [], height: 0 }
			: packBars(g.tasks, today);
		const height = collapsed
			? WORKLOAD_STRIP_HEIGHT
			: groupHeight(stackHeight) + WORKLOAD_STRIP_HEIGHT;
		rows.push({
			key: g.key,
			label: g.label,
			assignee: g.assignee,
			top,
			height,
			bars,
			workload: dailyWorkload(g.tasks),
			taskCount: g.tasks.length,
			collapsed,
		});
		top += height;
	}
	return { rows, totalHeight: top };
}
