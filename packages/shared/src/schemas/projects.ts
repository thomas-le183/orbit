import { z } from "zod";

export const PROJECT_STATUS_TYPES = [
	"draft",
	"planning",
	"execution",
	"monitoring",
	"completed",
] as const;
export type ProjectStatusType = (typeof PROJECT_STATUS_TYPES)[number];

export const createProjectSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	statusId: z.string().optional(),
	color: z.string().max(32).optional(),
	startDate: z.string().date().optional(),
	endDate: z.string().date().optional(),
	teamIds: z.array(z.string()).optional(),
	labelIds: z.array(z.string()).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const setProjectTeamsSchema = z.object({
	teamIds: z.array(z.string()),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type SetProjectTeamsInput = z.infer<typeof setProjectTeamsSchema>;
