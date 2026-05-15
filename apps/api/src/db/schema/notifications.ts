import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const notification = pgTable("notification", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	title: text("title").notNull(),
	body: text("body").notNull(),
	read: boolean("read").notNull().default(false),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationRelations = relations(notification, ({ one }) => ({
	user: one(user, {
		fields: [notification.userId],
		references: [user.id],
	}),
}));
