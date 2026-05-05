import {
	Controller,
	ForbiddenException,
	Get,
	Param,
	Query,
} from "@nestjs/common";
import type { Session, User } from "../../auth/types";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { MessagesService } from "./messages.service";

@Controller()
export class MessagesController {
	constructor(private readonly messagesService: MessagesService) {}

	@Get("channels/:id/messages")
	async channelMessages(
		@Param("id") channelId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
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
		@CurrentUser() user: User,
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
		@CurrentUser() user: User,
	) {
		return this.messagesService.getThreadMessages(messageId, user.id);
	}

	private requireOrgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
