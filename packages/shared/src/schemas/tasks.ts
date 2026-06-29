import { z } from "zod";

export const TASK_STATUS_TYPES = [
	"backlog",
	"planned",
	"in_progress",
	"done",
	"canceled",
] as const;
export type TaskStatusType = (typeof TASK_STATUS_TYPES)[number];

export const TASK_PRIORITIES = [
	"none",
	"low",
	"medium",
	"high",
	"urgent",
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const createTaskSchema = z.object({
	name: z.string().min(1).max(500),
	parentId: z.string().optional(),
	description: z.string().max(5000).optional(),
	statusId: z.string().optional(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	progress: z.number().int().min(0).max(100).optional(),
	startDate: z.string().date().optional(),
	endDate: z.string().date().optional(),
	color: z.string().max(32).optional(),
	assigneeId: z.string().uuid().optional(),
	position: z.number().int().optional(),
	labelIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const moveTaskSchema = z.object({
	parentId: z.string().nullable().optional(),
	position: z.number().int(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
