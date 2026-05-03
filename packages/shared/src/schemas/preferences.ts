import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);
export const weekStartSchema = z.union([z.literal(0), z.literal(1)]);

export const userPreferencesSchema = z.object({
	theme: themeSchema.default("system"),
	language: z.string().min(2).max(10).default("en"),
	dateFormat: z.string().min(1).default("DD/MM/YYYY"),
	timezone: z.string().min(1).optional(),
	weekStart: weekStartSchema.default(0),
});

export const updateUserPreferencesSchema = userPreferencesSchema.partial();

export type Theme = z.infer<typeof themeSchema>;
export type WeekStart = z.infer<typeof weekStartSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesInput = z.infer<
	typeof updateUserPreferencesSchema
>;
