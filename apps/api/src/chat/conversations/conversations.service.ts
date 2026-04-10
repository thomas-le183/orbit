import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";

@Injectable()
export class ConversationsService {
	constructor(@Inject(DB) private readonly db: Db) {}

	async listConversations(orgId: string, userId: string) {
		// Conversations in this org where the user is a participant
		const rows = await this.db
			.select({ conversation: schema.conversation })
			.from(schema.conversation)
			.innerJoin(
				schema.conversationParticipant,
				and(
					eq(
						schema.conversationParticipant.conversationId,
						schema.conversation.id,
					),
					eq(schema.conversationParticipant.userId, userId),
				),
			)
			.where(eq(schema.conversation.organizationId, orgId))
			.orderBy(schema.conversation.createdAt);

		const conversations = rows.map((r) => r.conversation);

		// Attach participants to each conversation
		return Promise.all(
			conversations.map(async (conv) => {
				const participants = await this.db.query.conversationParticipant.findMany(
					{
						where: eq(
							schema.conversationParticipant.conversationId,
							conv.id,
						),
					},
				);
				return { ...conv, participants };
			}),
		);
	}

	async findOrCreate(orgId: string, userId: string, participantIds: string[]) {
		// Always include the requesting user in the participant set, deduplicate
		const participantSet = [...new Set([userId, ...participantIds])].sort();

		// Find existing conversation in this org where the user is a participant
		const userConvos = await this.db
			.select({
				conversationId: schema.conversationParticipant.conversationId,
			})
			.from(schema.conversationParticipant)
			.innerJoin(
				schema.conversation,
				eq(
					schema.conversation.id,
					schema.conversationParticipant.conversationId,
				),
			)
			.where(
				and(
					eq(schema.conversationParticipant.userId, userId),
					eq(schema.conversation.organizationId, orgId),
				),
			);

		// Check each candidate for an exact participant-set match
		for (const { conversationId } of userConvos) {
			const participants = await this.db.query.conversationParticipant.findMany(
				{
					where: eq(
						schema.conversationParticipant.conversationId,
						conversationId,
					),
				},
			);

			const existingSet = participants
				.map((p) => p.userId)
				.sort();

			const isExactMatch =
				existingSet.length === participantSet.length &&
				existingSet.every((id, i) => id === participantSet[i]);

			if (isExactMatch) {
				return { conversationId, participants };
			}
		}

		// No match — create a new conversation
		const id = randomUUID();
		const now = new Date();

		await this.db
			.insert(schema.conversation)
			.values({ id, organizationId: orgId, createdAt: now });

		const participants = participantSet.map((uid) => ({
			id: randomUUID(),
			conversationId: id,
			userId: uid,
			joinedAt: now,
		}));

		await this.db.insert(schema.conversationParticipant).values(participants);

		return { conversationId: id, participants };
	}
}
