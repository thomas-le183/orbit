import {
	Controller,
	ForbiddenException,
	Get,
	Param,
	Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { MessagesService } from "./messages.service";

@Controller()
export class MessagesController {
	constructor(private readonly messagesService: MessagesService) {}

	@Get("channels/:id/messages")
	async channelMessages(
		@Param("id") channelId: string,
		@Session() { user, session }: UserSession,
		@Query("beforeId") beforeId?: string,
	) {
		const orgId = this.requireOrgId(session);
		return this.messagesService.getChannelMessages(
			channelId,
			user.id,
			orgId,
			beforeId,
		);
	}

	@Get("conversations/:id/messages")
	async conversationMessages(
		@Param("id") conversationId: string,
		@Session() { user }: UserSession,
		@Query("beforeId") beforeId?: string,
	) {
		return this.messagesService.getConversationMessages(
			conversationId,
			user.id,
			beforeId,
		);
	}

	@Get("messages/:id/thread")
	async threadMessages(
		@Param("id") messageId: string,
		@Session() { user }: UserSession,
	) {
		return this.messagesService.getThreadMessages(messageId, user.id);
	}

	private requireOrgId(session: { activeOrganizationId?: string | null }): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
