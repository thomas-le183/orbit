import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";

export type GroupingMode = "assignee";

export type GroupRow = {
	key: string;
	label: string;
	assignee?: TaskAssignee;
	tasks: TimelineItem[];
};

const UNASSIGNED_KEY = "unassigned";

/**
 * Bucket schedulable tasks into rows. Launch mode: one row per assignee (sorted
 * by name) plus a trailing "Unassigned" row. Only leaf, non-milestone tasks are
 * included — parent containers and milestones are dropped.
 *
 * `allAssignees` seeds a row for every known member so people with no assigned
 * tasks still appear as (empty) rows.
 */
export function buildGroupRows(
	items: TimelineItem[],
	_mode: GroupingMode,
	allAssignees: TaskAssignee[] = [],
): GroupRow[] {
	const parentIds = new Set(
		items.map((i) => i.parentId).filter((id): id is string => id !== null),
	);
	const schedulable = items.filter(
		(i) => i.kind === "task" && !parentIds.has(i.id),
	);

	const byKey = new Map<string, GroupRow>();
	for (const a of allAssignees) {
		byKey.set(a.id, { key: a.id, label: a.name, assignee: a, tasks: [] });
	}
	for (const task of schedulable) {
		const a = task.assignee;
		const key = a?.id ?? UNASSIGNED_KEY;
		const existing = byKey.get(key);
		if (existing) {
			existing.tasks.push(task);
		} else {
			byKey.set(key, {
				key,
				label: a?.name ?? "Unassigned",
				assignee: a,
				tasks: [task],
			});
		}
	}

	const unassigned = byKey.get(UNASSIGNED_KEY);
	byKey.delete(UNASSIGNED_KEY);

	const rows = [...byKey.values()].sort((x, y) =>
		x.label.localeCompare(y.label),
	);
	if (unassigned) rows.push(unassigned);
	return rows;
}
