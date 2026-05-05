import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userPreferences = pgTable("user_preferences", {
	userId: uuid("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	theme: text("theme").notNull().default("system"),
	language: text("language").notNull().default("en"),
	dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
	timezone: text("timezone"),
	weekStart: integer("week_start").notNull().default(0),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(user, {
		fields: [userPreferences.userId],
		references: [user.id],
	}),
}));
