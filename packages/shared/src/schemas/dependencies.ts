import { z } from "zod";

export const DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const createDependencySchema = z.object({
	predecessorId: z.string().min(1),
	successorId: z.string().min(1),
	type: z.enum(DEPENDENCY_TYPES).default("FS"),
});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
