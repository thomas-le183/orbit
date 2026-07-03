import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import type { Milestone, Task } from "@/hooks/use-tasks";

/** Fallback bar/marker color when a task/milestone has none. */
export const DEFAULT_TASK_COLOR = "#6366f1";

export type UndatedTaskRow = {
	id: string;
	name: string;
	parentId: string | null;
};

export type MilestoneMarker = {
	id: string;
	date: string;
	name: string;
	color: string;
};

/**
 * Split a project's tasks into dated timeline bars and undated rows, and map
 * milestones to axis markers. A task is "dated" if it has a start or end date;
 * the missing endpoint is backfilled from the present one.
 */
export function mapProjectData(
	tasks: Task[],
	milestones: Milestone[],
	assigneeById?: Map<string, TaskAssignee>,
): {
	items: TimelineItem[];
	undatedTaskRows: UndatedTaskRow[];
	milestoneMarkers: MilestoneMarker[];
} {
	const items: TimelineItem[] = [];
	const undatedTaskRows: UndatedTaskRow[] = [];

	for (const t of tasks) {
		const start = t.startDate ?? t.endDate;
		const end = t.endDate ?? t.startDate;
		if (start && end) {
			items.push({
				id: t.id,
				kind: "task",
				name: t.name,
				parentId: t.parentId,
				startDate: start,
				endDate: end,
				progress: t.progress,
				color: t.color ?? DEFAULT_TASK_COLOR,
				assignee: t.assigneeId ? assigneeById?.get(t.assigneeId) : undefined,
			});
		} else {
			undatedTaskRows.push({ id: t.id, name: t.name, parentId: t.parentId });
		}
	}

	const milestoneMarkers: MilestoneMarker[] = milestones.map((m) => ({
		id: m.id,
		date: m.date,
		name: m.name,
		color: m.color ?? DEFAULT_TASK_COLOR,
	}));

	return { items, undatedTaskRows, milestoneMarkers };
}
