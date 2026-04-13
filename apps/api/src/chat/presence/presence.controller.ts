import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	Patch,
	UseGuards,
} from "@nestjs/common";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { UpdatePresenceDto } from "./presence.dto";
import { PresenceService } from "./presence.service";

@UseGuards(AuthGuard)
@Controller("presence")
export class PresenceController {
	constructor(private readonly presenceService: PresenceService) {}

	@Get()
	async getOrgPresence(@CurrentSession() session: Session) {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return this.presenceService.getOrgPresence(session.activeOrganizationId);
	}

	@Patch()
	async update(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
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
