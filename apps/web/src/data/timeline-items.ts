export type TimelineItemKind = "task" | "milestone";

export type TaskStatus =
	| "todo"
	| "in_progress"
	| "in_review"
	| "done"
	| "blocked";

export type TaskAssignee = {
	id: string;
	name: string;
	avatarUrl: string;
};

export type TimelineItem = {
	id: string;
	kind: TimelineItemKind;
	name: string;
	/** null = top-level; otherwise the id of the parent task. */
	parentId: string | null;
	/** ISO YYYY-MM-DD. For milestones, the single date. */
	startDate: string;
	/** ISO YYYY-MM-DD, inclusive. For milestones, equals startDate. */
	endDate: string;
	/** 0–100, leaf tasks only. */
	progress?: number;
	/** Estimated effort in minutes, leaf tasks only. Drives bar height in scheduler. */
	estimatedTime?: number;
	color: string;
	assignee?: TaskAssignee;
	status?: TaskStatus;
};
