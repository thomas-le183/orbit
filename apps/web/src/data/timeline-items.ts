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
	color: string;
	assignee?: TaskAssignee;
	status?: TaskStatus;
};

const assignees: Record<string, TaskAssignee> = {
	maya: {
		id: "u_maya",
		name: "Maya Chen",
		avatarUrl: "https://i.pravatar.cc/64?u=maya",
	},
	leo: {
		id: "u_leo",
		name: "Leo Martins",
		avatarUrl: "https://i.pravatar.cc/64?u=leo",
	},
	priya: {
		id: "u_priya",
		name: "Priya Nair",
		avatarUrl: "https://i.pravatar.cc/64?u=priya",
	},
	noah: {
		id: "u_noah",
		name: "Noah Becker",
		avatarUrl: "https://i.pravatar.cc/64?u=noah",
	},
	sofia: {
		id: "u_sofia",
		name: "Sofia Rossi",
		avatarUrl: "https://i.pravatar.cc/64?u=sofia",
	},
};

// Parent tasks carry placeholder dates; their rendered span is derived from children.
export const timelineItems: TimelineItem[] = [
	{
		id: "ms-kickoff",
		kind: "milestone",
		name: "Kickoff",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-01",
		color: "#0ea5e9",
	},

	{
		id: "p-platform",
		kind: "task",
		name: "Core Platform",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-09-18",
		color: "#6366f1",
	},
	{
		id: "t-design",
		kind: "task",
		name: "Design system foundations",
		parentId: "p-platform",
		startDate: "2026-06-15",
		endDate: "2026-06-30",
		progress: 65,
		color: "#ec4899",
		status: "in_progress",
		assignee: assignees.sofia,
	},
	{
		id: "t-api",
		kind: "task",
		name: "API schema & data model",
		parentId: "p-platform",
		startDate: "2026-06-22",
		endDate: "2026-07-10",
		progress: 40,
		color: "#f59e0b",
		status: "in_progress",
		assignee: assignees.leo,
	},
	{
		id: "t-axis",
		kind: "task",
		name: "Timeline calendar axis",
		parentId: "p-platform",
		startDate: "2026-06-26",
		endDate: "2026-07-17",
		progress: 25,
		color: "#10b981",
		status: "in_progress",
		assignee: assignees.noah,
	},
	{
		id: "t-auth",
		kind: "task",
		name: "Authentication & onboarding",
		parentId: "p-platform",
		startDate: "2026-07-13",
		endDate: "2026-07-31",
		progress: 0,
		color: "#3b82f6",
		status: "todo",
		assignee: assignees.leo,
	},
	{
		id: "ms-beta",
		kind: "milestone",
		name: "Beta launch",
		parentId: "p-platform",
		startDate: "2026-09-14",
		endDate: "2026-09-14",
		color: "#0ea5e9",
	},

	{
		id: "p-billing",
		kind: "task",
		name: "Billing & Payments",
		parentId: null,
		startDate: "2026-07-20",
		endDate: "2026-09-30",
		color: "#ef4444",
	},
	{
		id: "t-billing",
		kind: "task",
		name: "Billing integration",
		parentId: "p-billing",
		startDate: "2026-07-20",
		endDate: "2026-08-14",
		progress: 0,
		color: "#ef4444",
		status: "blocked",
		assignee: assignees.maya,
	},
	{
		id: "t-invoicing",
		kind: "task",
		name: "Invoicing & receipts",
		parentId: "p-billing",
		startDate: "2026-08-10",
		endDate: "2026-09-05",
		progress: 0,
		color: "#f97316",
		status: "todo",
		assignee: assignees.priya,
	},
];
