export type TaskStatus =
	| "todo"
	| "in_progress"
	| "in_review"
	| "done"
	| "blocked";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskAssignee = {
	id: string;
	name: string;
	avatarUrl: string;
};

export type Task = {
	id: string;
	name: string;
	assignee: TaskAssignee;
	/** ISO date (YYYY-MM-DD), inclusive start. */
	startDate: string;
	/** ISO date (YYYY-MM-DD), inclusive end. */
	endDate: string;
	status: TaskStatus;
	priority: TaskPriority;
	/** Completion percentage, 0–100. */
	progress: number;
	projectId: string;
	color: string;
	/** Ids of tasks that must finish before this one starts. */
	dependencies: string[];
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

export const tasks: Task[] = [
	{
		id: "task-1",
		name: "Project kickoff & scope",
		assignee: assignees.maya,
		startDate: "2026-06-01",
		endDate: "2026-06-05",
		status: "done",
		priority: "high",
		progress: 100,
		projectId: "proj-platform",
		color: "#6366f1",
		dependencies: [],
	},
	{
		id: "task-2",
		name: "Discovery & user research",
		assignee: assignees.priya,
		startDate: "2026-06-08",
		endDate: "2026-06-19",
		status: "done",
		priority: "medium",
		progress: 100,
		projectId: "proj-platform",
		color: "#8b5cf6",
		dependencies: ["task-1"],
	},
	{
		id: "task-3",
		name: "Design system foundations",
		assignee: assignees.sofia,
		startDate: "2026-06-15",
		endDate: "2026-06-30",
		status: "in_progress",
		priority: "high",
		progress: 65,
		projectId: "proj-platform",
		color: "#ec4899",
		dependencies: ["task-2"],
	},
	{
		id: "task-4",
		name: "API schema & data model",
		assignee: assignees.leo,
		startDate: "2026-06-22",
		endDate: "2026-07-10",
		status: "in_progress",
		priority: "urgent",
		progress: 40,
		projectId: "proj-platform",
		color: "#f59e0b",
		dependencies: ["task-2"],
	},
	{
		id: "task-5",
		name: "Timeline calendar axis",
		assignee: assignees.noah,
		startDate: "2026-06-26",
		endDate: "2026-07-17",
		status: "in_progress",
		priority: "high",
		progress: 25,
		projectId: "proj-platform",
		color: "#10b981",
		dependencies: ["task-3"],
	},
	{
		id: "task-6",
		name: "Authentication & onboarding",
		assignee: assignees.leo,
		startDate: "2026-07-13",
		endDate: "2026-07-31",
		status: "todo",
		priority: "high",
		progress: 0,
		projectId: "proj-platform",
		color: "#3b82f6",
		dependencies: ["task-4"],
	},
	{
		id: "task-7",
		name: "Billing integration",
		assignee: assignees.maya,
		startDate: "2026-07-20",
		endDate: "2026-08-14",
		status: "blocked",
		priority: "urgent",
		progress: 0,
		projectId: "proj-billing",
		color: "#ef4444",
		dependencies: ["task-4", "task-6"],
	},
	{
		id: "task-8",
		name: "Dashboard & reporting",
		assignee: assignees.priya,
		startDate: "2026-08-03",
		endDate: "2026-08-28",
		status: "todo",
		priority: "medium",
		progress: 0,
		projectId: "proj-platform",
		color: "#14b8a6",
		dependencies: ["task-5", "task-6"],
	},
	{
		id: "task-9",
		name: "QA & accessibility audit",
		assignee: assignees.sofia,
		startDate: "2026-08-24",
		endDate: "2026-09-11",
		status: "todo",
		priority: "medium",
		progress: 0,
		projectId: "proj-platform",
		color: "#a855f7",
		dependencies: ["task-7", "task-8"],
	},
	{
		id: "task-10",
		name: "Beta launch",
		assignee: assignees.noah,
		startDate: "2026-09-14",
		endDate: "2026-09-18",
		status: "todo",
		priority: "urgent",
		progress: 0,
		projectId: "proj-platform",
		color: "#0ea5e9",
		dependencies: ["task-9"],
	},
];
