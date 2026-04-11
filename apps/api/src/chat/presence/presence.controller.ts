import { Body, Controller, ForbiddenException, Patch, UseGuards } from "@nestjs/common";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PresenceService } from "./presence.service";

@UseGuards(AuthGuard)
@Controller("presence")
export class PresenceController {
	constructor(private readonly presenceService: PresenceService) {}

	@Patch()
	async update(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body()
		body: {
			status?: string;
			customStatus?: string | null;
			customStatusEmoji?: string | null;
		},
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
