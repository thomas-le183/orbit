import { randomUUID } from "node:crypto";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";

type ReactionSummary = { emoji: string; count: number; userIds: string[] };

type MessageRow = typeof schema.message.$inferSelect & {
	sender: typeof schema.user.$inferSelect;
	attachments: (typeof schema.messageAttachment.$inferSelect)[];
	reactions: (typeof schema.messageReaction.$inferSelect)[];
	replies: { id: string }[];
};

function groupReactions(
	reactions: (typeof schema.messageReaction.$inferSelect)[],
): ReactionSummary[] {
	const map = new Map<string, ReactionSummary>();
	for (const r of reactions) {
		const entry = map.get(r.emoji);
		if (entry) {
			entry.count++;
			entry.userIds.push(r.userId);
		} else {
			map.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
		}
	}
	return [...map.values()];
}

function formatMessage(msg: MessageRow) {
	return {
		...msg,
		content: msg.deletedAt ? "Message deleted" : msg.content,
		reactions: groupReactions(msg.reactions),
		replyCount: msg.replies.length,
		replies: undefined,
	};
}

@Injectable()
export class MessagesService {
	constructor(@Inject(DB) private readonly db: Db) {}

	// ── Read ───────────────────────────────────────────────────────────────────

	async getChannelMessages(
		channelId: string,
		userId: string,
		orgId: string,
		beforeId?: string,
		limit = 50,
	) {
		const channel = await this.db.query.channel.findFirst({
			where: and(
				eq(schema.channel.id, channelId),
				eq(schema.channel.organizationId, orgId),
			),
		});
		if (!channel) throw new NotFoundException("Channel not found");

		if (channel.isPrivate) {
			const membership = await this.db.query.channelMember.findFirst({
				where: and(
					eq(schema.channelMember.channelId, channelId),
					eq(schema.channelMember.userId, userId),
				),
			});
			if (!membership)
				throw new ForbiddenException("Not a member of this channel");
		}

		const cursor = await this.resolveCursor(beforeId);

		const messages = await this.db.query.message.findMany({
			where: and(
				eq(schema.message.channelId, channelId),
				isNull(schema.message.parentMessageId),
				cursor ? lt(schema.message.createdAt, cursor) : undefined,
			),
			with: {
				sender: true,
				attachments: true,
				reactions: true,
				replies: { columns: { id: true } },
			},
			orderBy: [desc(schema.message.createdAt)],
			limit,
		});

		return (messages as MessageRow[]).map(formatMessage);
	}

	async getConversationMessages(
		conversationId: string,
		userId: string,
		beforeId?: string,
		limit = 50,
	) {
		const participant = await this.db.query.conversationParticipant.findFirst({
			where: and(
				eq(schema.conversationParticipant.conversationId, conversationId),
				eq(schema.conversationParticipant.userId, userId),
			),
		});
		if (!participant) throw new ForbiddenException("Not a participant");

		const cursor = await this.resolveCursor(beforeId);

		const messages = await this.db.query.message.findMany({
			where: and(
				eq(schema.message.conversationId, conversationId),
				isNull(schema.message.parentMessageId),
				cursor ? lt(schema.message.createdAt, cursor) : undefined,
			),
			with: {
				sender: true,
				attachments: true,
				reactions: true,
				replies: { columns: { id: true } },
			},
			orderBy: [desc(schema.message.createdAt)],
			limit,
		});

		return (messages as MessageRow[]).map(formatMessage);
	}

	async getThreadMessages(messageId: string, userId: string) {
		const parent = await this.db.query.message.findFirst({
			where: eq(schema.message.id, messageId),
		});
		if (!parent) throw new NotFoundException("Message not found");

		// Verify the user has access to the room this message is in
		await this.assertMessageAccess(parent, userId);

		const replies = await this.db.query.message.findMany({
			where: eq(schema.message.parentMessageId, messageId),
			with: {
				sender: true,
				attachments: true,
				reactions: true,
				replies: { columns: { id: true } },
			},
			orderBy: [desc(schema.message.createdAt)],
		});

		return (replies as MessageRow[]).map(formatMessage);
	}

	// ── Write (called by WebSocket gateway in Phase 6) ─────────────────────────

	async createMessage(dto: {
		channelId?: string;
		conversationId?: string;
		senderId: string;
		content: string;
		parentMessageId?: string;
		storageKeys?: string[];
	}) {
		const id = randomUUID();
		const now = new Date();

		await this.db.insert(schema.message).values({
			id,
			channelId: dto.channelId ?? null,
			conversationId: dto.conversationId ?? null,
			senderId: dto.senderId,
			content: dto.content,
			parentMessageId: dto.parentMessageId ?? null,
			createdAt: now,
			updatedAt: now,
		});

		if (dto.storageKeys?.length) {
			await this.db.insert(schema.messageAttachment).values(
				dto.storageKeys.map((key) => ({
					id: randomUUID(),
					messageId: id,
					fileName: key.split("/").pop() ?? key,
					fileSize: 0,
					mimeType: "application/octet-stream",
					storageKey: key,
					createdAt: now,
				})),
			);
		}

		return this.getFullMessage(id);
	}

	async editMessage(
		messageId: string,
		userId: string,
		orgRole: string,
		content: string,
	) {
		const msg = await this.db.query.message.findFirst({
			where: eq(schema.message.id, messageId),
		});
		if (!msg) throw new NotFoundException("Message not found");
		if (msg.senderId !== userId && orgRole !== "owner" && orgRole !== "admin") {
			throw new ForbiddenException("Not authorised to edit this message");
		}

		await this.db
			.update(schema.message)
			.set({ content, updatedAt: new Date() })
			.where(eq(schema.message.id, messageId));

		return this.db.query.message.findFirst({
			where: eq(schema.message.id, messageId),
		});
	}

	async softDeleteMessage(messageId: string, userId: string, orgRole: string) {
		const msg = await this.db.query.message.findFirst({
			where: eq(schema.message.id, messageId),
		});
		if (!msg) throw new NotFoundException("Message not found");
		if (msg.senderId !== userId && orgRole !== "owner" && orgRole !== "admin") {
			throw new ForbiddenException("Not authorised to delete this message");
		}

		await this.db
			.update(schema.message)
			.set({ deletedAt: new Date() })
			.where(eq(schema.message.id, messageId));
	}

	async toggleReaction(messageId: string, userId: string, emoji: string) {
		const existing = await this.db.query.messageReaction.findFirst({
			where: and(
				eq(schema.messageReaction.messageId, messageId),
				eq(schema.messageReaction.userId, userId),
				eq(schema.messageReaction.emoji, emoji),
			),
		});

		if (existing) {
			await this.db
				.delete(schema.messageReaction)
				.where(eq(schema.messageReaction.id, existing.id));
		} else {
			await this.db.insert(schema.messageReaction).values({
				id: randomUUID(),
				messageId,
				userId,
				emoji,
				createdAt: new Date(),
			});
		}

		const reactions = await this.db.query.messageReaction.findMany({
			where: eq(schema.messageReaction.messageId, messageId),
		});

		return groupReactions(reactions);
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private async resolveCursor(beforeId?: string): Promise<Date | undefined> {
		if (!beforeId) return undefined;
		const msg = await this.db.query.message.findFirst({
			where: eq(schema.message.id, beforeId),
		});
		return msg?.createdAt;
	}

	private async assertMessageAccess(
		msg: typeof schema.message.$inferSelect,
		userId: string,
	) {
		if (msg.conversationId) {
			const p = await this.db.query.conversationParticipant.findFirst({
				where: and(
					eq(schema.conversationParticipant.conversationId, msg.conversationId),
					eq(schema.conversationParticipant.userId, userId),
				),
			});
			if (!p) throw new ForbiddenException("Not a participant");
			return;
		}

		if (msg.channelId) {
			const channel = await this.db.query.channel.findFirst({
				where: eq(schema.channel.id, msg.channelId),
			});
			if (!channel) throw new NotFoundException("Channel not found");

			if (channel.isPrivate) {
				const membership = await this.db.query.channelMember.findFirst({
					where: and(
						eq(schema.channelMember.channelId, msg.channelId),
						eq(schema.channelMember.userId, userId),
					),
				});
				if (!membership) throw new ForbiddenException("Not a member of this channel");
			}
		}
	}

	async getFullMessage(messageId: string) {
		const msg = await this.db.query.message.findFirst({
			where: eq(schema.message.id, messageId),
			with: {
				sender: true,
				attachments: true,
				reactions: true,
				replies: { columns: { id: true } },
			},
		});
		if (!msg) throw new NotFoundException("Message not found");
		return formatMessage(msg as MessageRow);
	}
}
