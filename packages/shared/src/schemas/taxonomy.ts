import { z } from "zod";
import { PROJECT_STATUS_TYPES } from "./projects.js";
import { TASK_STATUS_TYPES } from "./tasks.js";

export const createTaskStatusSchema = z.object({
	type: z.enum(TASK_STATUS_TYPES),
	name: z.string().min(1).max(100),
	color: z.string().max(32).optional(),
	position: z.number().int().optional(),
});
export const updateTaskStatusSchema = createTaskStatusSchema.partial();

export const createProjectStatusSchema = z.object({
	type: z.enum(PROJECT_STATUS_TYPES),
	name: z.string().min(1).max(100),
	color: z.string().max(32).optional(),
	position: z.number().int().optional(),
});
export const updateProjectStatusSchema = createProjectStatusSchema.partial();

export const createLabelSchema = z.object({
	name: z.string().min(1).max(100),
	color: z.string().max(32).optional(),
});
export const updateLabelSchema = createLabelSchema.partial();

export const deleteStatusSchema = z.object({
	reassignTo: z.string().optional(),
});

export type CreateTaskStatusInput = z.infer<typeof createTaskStatusSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type CreateProjectStatusInput = z.infer<
	typeof createProjectStatusSchema
>;
export type UpdateProjectStatusInput = z.infer<
	typeof updateProjectStatusSchema
>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type DeleteStatusInput = z.infer<typeof deleteStatusSchema>;
