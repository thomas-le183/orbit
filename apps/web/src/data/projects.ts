export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

export type Project = {
	id: string;
	name: string;
	description: string;
	status: ProjectStatus;
	color: string;
	/** Id of the user leading the project (see assignees in tasks.ts). */
	leadId: string;
	/** ISO date (YYYY-MM-DD). */
	startDate: string;
	/** ISO date (YYYY-MM-DD). */
	endDate: string;
};

export const projects: Project[] = [
	{
		id: "proj-platform",
		name: "Core Platform",
		description:
			"Foundational product surface: design system, API, timeline, and dashboards.",
		status: "active",
		color: "#6366f1",
		leadId: "u_maya",
		startDate: "2026-06-01",
		endDate: "2026-09-18",
	},
	{
		id: "proj-billing",
		name: "Billing & Payments",
		description:
			"Subscription billing, invoicing, and payment provider integration.",
		status: "active",
		color: "#ef4444",
		leadId: "u_leo",
		startDate: "2026-07-20",
		endDate: "2026-09-30",
	},
	{
		id: "proj-mobile",
		name: "Mobile App",
		description: "Companion iOS and Android clients built on the shared API.",
		status: "planning",
		color: "#10b981",
		leadId: "u_noah",
		startDate: "2026-08-01",
		endDate: "2026-11-15",
	},
	{
		id: "proj-growth",
		name: "Growth & Marketing",
		description:
			"Landing pages, onboarding funnels, and analytics instrumentation.",
		status: "on_hold",
		color: "#f59e0b",
		leadId: "u_priya",
		startDate: "2026-09-01",
		endDate: "2026-12-01",
	},
];
