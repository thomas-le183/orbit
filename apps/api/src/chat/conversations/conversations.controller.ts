import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Post,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { FindOrCreateConversationDto } from "./conversations.dto";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
	constructor(private readonly conversationsService: ConversationsService) {}

	@Get()
	async list(@Session() { user, session }: UserSession) {
		const orgId = this.requireOrgId(session);
		return this.conversationsService.listConversations(orgId, user.id);
	}

	@Post()
	async findOrCreate(
		@Session() { user, session }: UserSession,
		@Body() body: FindOrCreateConversationDto,
	) {
		const orgId = this.requireOrgId(session);
		return this.conversationsService.findOrCreate(
			orgId,
			user.id,
			body.participantIds,
		);
	}

	private requireOrgId(session: { activeOrganizationId?: string | null }): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
