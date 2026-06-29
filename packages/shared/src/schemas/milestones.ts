import { z } from "zod";

export const createMilestoneSchema = z.object({
	name: z.string().min(1).max(300),
	date: z.string().date(),
	description: z.string().max(2000).optional(),
	color: z.string().max(32).optional(),
	position: z.number().int().optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().extend({
	completedAt: z.string().datetime().nullable().optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
