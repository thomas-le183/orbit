import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows, type GroupingMode } from "./group-rows";
import { type PackedBar, packLanes } from "./pack-lanes";
import { groupHeight } from "./row-metrics";

export type SchedulerRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	top: number;
	height: number;
	lanes: PackedBar[][];
};

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
		const lanes = packLanes(g.tasks, today);
		const height = groupHeight(lanes.length);
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
