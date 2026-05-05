import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Post,
} from "@nestjs/common";
import type { Session, User } from "../../auth/types";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { FindOrCreateConversationDto } from "./conversations.dto";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
	constructor(private readonly conversationsService: ConversationsService) {}

	@Get()
	async list(@CurrentUser() user: User, @CurrentSession() session: Session) {
		const orgId = this.requireOrgId(session);
		return this.conversationsService.listConversations(orgId, user.id);
	}

	@Post()
	async findOrCreate(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: FindOrCreateConversationDto,
	) {
		const orgId = this.requireOrgId(session);
		return this.conversationsService.findOrCreate(
			orgId,
			user.id,
			body.participantIds,
		);
	}

	private requireOrgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
