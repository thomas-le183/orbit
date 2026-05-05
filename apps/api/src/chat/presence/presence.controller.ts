import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Patch,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { UpdatePresenceDto } from "./presence.dto";
import { PresenceService } from "./presence.service";

@Controller("presence")
export class PresenceController {
	constructor(private readonly presenceService: PresenceService) {}

	@Get()
	async getOrgPresence(@Session() { session }: UserSession) {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return this.presenceService.getOrgPresence(session.activeOrganizationId);
	}

	@Patch()
	async update(
		@Session() { user, session }: UserSession,
		@Body() body: UpdatePresenceDto,
	) {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return this.presenceService.upsertPresence(
			user.id,
			session.activeOrganizationId,
			body.status ?? "online",
			body.customStatus,
			body.customStatusEmoji,
		);
	}
}
