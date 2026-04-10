import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// ---------- Chat tables ----------

export const channel = pgTable("channel", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	isPrivate: boolean("is_private").notNull().default(false),
	createdBy: text("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const channelMember = pgTable("channel_member", {
	id: text("id").primaryKey(),
	channelId: text("channel_id")
		.notNull()
		.references(() => channel.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	role: text("role").notNull().default("member"),
	joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const conversation = pgTable("conversation", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationParticipant = pgTable("conversation_participant", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id")
		.notNull()
		.references(() => conversation.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const message = pgTable("message", {
	id: text("id").primaryKey(),
	channelId: text("channel_id").references(() => channel.id, {
		onDelete: "cascade",
	}),
	conversationId: text("conversation_id").references(() => conversation.id, {
		onDelete: "cascade",
	}),
	senderId: text("sender_id")
		.notNull()
		.references(() => user.id),
	content: text("content").notNull(),
	parentMessageId: text("parent_message_id"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	deletedAt: timestamp("deleted_at"),
});

export const messageAttachment = pgTable("message_attachment", {
	id: text("id").primaryKey(),
	messageId: text("message_id")
		.notNull()
		.references(() => message.id, { onDelete: "cascade" }),
	fileName: text("file_name").notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	storageKey: text("storage_key").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messageReaction = pgTable("message_reaction", {
	id: text("id").primaryKey(),
	messageId: text("message_id")
		.notNull()
		.references(() => message.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	emoji: text("emoji").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userPresence = pgTable(
	"user_presence",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		status: text("status").notNull().default("offline"),
		customStatus: text("custom_status"),
		customStatusEmoji: text("custom_status_emoji"),
		lastSeenAt: timestamp("last_seen_at"),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.organizationId] })],
);

// ---------- Relations ----------

export const channelRelations = relations(channel, ({ many }) => ({
	members: many(channelMember),
	messages: many(message),
}));

export const channelMemberRelations = relations(channelMember, ({ one }) => ({
	channel: one(channel, {
		fields: [channelMember.channelId],
		references: [channel.id],
	}),
	user: one(user, {
		fields: [channelMember.userId],
		references: [user.id],
	}),
}));

export const conversationRelations = relations(conversation, ({ many }) => ({
	participants: many(conversationParticipant),
	messages: many(message),
}));

export const conversationParticipantRelations = relations(
	conversationParticipant,
	({ one }) => ({
		conversation: one(conversation, {
			fields: [conversationParticipant.conversationId],
			references: [conversation.id],
		}),
		user: one(user, {
			fields: [conversationParticipant.userId],
			references: [user.id],
		}),
	}),
);

export const messageRelations = relations(message, ({ one, many }) => ({
	channel: one(channel, {
		fields: [message.channelId],
		references: [channel.id],
	}),
	conversation: one(conversation, {
		fields: [message.conversationId],
		references: [conversation.id],
	}),
	sender: one(user, {
		fields: [message.senderId],
		references: [user.id],
	}),
	parent: one(message, {
		fields: [message.parentMessageId],
		references: [message.id],
		relationName: "thread",
	}),
	replies: many(message, { relationName: "thread" }),
	attachments: many(messageAttachment),
	reactions: many(messageReaction),
}));

export const messageAttachmentRelations = relations(
	messageAttachment,
	({ one }) => ({
		message: one(message, {
			fields: [messageAttachment.messageId],
			references: [message.id],
		}),
	}),
);

export const messageReactionRelations = relations(
	messageReaction,
	({ one }) => ({
		message: one(message, {
			fields: [messageReaction.messageId],
			references: [message.id],
		}),
		user: one(user, {
			fields: [messageReaction.userId],
			references: [user.id],
		}),
	}),
);

export const userPresenceRelations = relations(userPresence, ({ one }) => ({
	user: one(user, {
		fields: [userPresence.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [userPresence.organizationId],
		references: [organization.id],
	}),
}));
