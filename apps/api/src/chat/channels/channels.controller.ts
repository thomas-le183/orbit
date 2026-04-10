import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import type { Session, User } from "../../auth/auth.constants";
import { ChannelsService } from "./channels.service";

@UseGuards(AuthGuard)
@Controller("channels")
export class ChannelsController {
	constructor(private readonly channelsService: ChannelsService) {}

	@Get()
	async list(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
	) {
		const orgId = this.requireOrgId(session);
		return this.channelsService.listChannels(orgId, user.id);
	}

	@Post()
	async create(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: { name: string; description?: string; isPrivate?: boolean },
	) {
		const orgId = this.requireOrgId(session);
		return this.channelsService.createChannel(orgId, user.id, body);
	}

	@Patch(":id")
	async update(
		@Param("id") channelId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: { name?: string; description?: string },
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		return this.channelsService.updateChannel(channelId, user.id, orgRole, body);
	}

	@Delete(":id")
	async remove(
		@Param("id") channelId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		await this.channelsService.deleteChannel(channelId, user.id, orgRole);
		return { deleted: true };
	}

	@Post(":id/members")
	async addMember(
		@Param("id") channelId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: { userId: string },
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		return this.channelsService.addMember(channelId, user.id, orgRole, body.userId);
	}

	@Delete(":id/members/:userId")
	async removeMember(
		@Param("id") channelId: string,
		@Param("userId") targetUserId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		await this.channelsService.removeMember(channelId, user.id, orgRole, targetUserId);
		return { removed: true };
	}

	private requireOrgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
