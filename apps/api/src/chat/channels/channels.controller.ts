import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
	AddChannelMemberDto,
	CreateChannelDto,
	UpdateChannelDto,
} from "./channels.dto";
import { ChannelsService } from "./channels.service";

@Controller("channels")
export class ChannelsController {
	constructor(private readonly channelsService: ChannelsService) {}

	@Get()
	async list(@Session() { user, session }: UserSession) {
		const orgId = this.requireOrgId(session);
		return this.channelsService.listChannels(orgId, user.id);
	}

	@Post()
	async create(
		@Session() { user, session }: UserSession,
		@Body() body: CreateChannelDto,
	) {
		const orgId = this.requireOrgId(session);
		return this.channelsService.createChannel(orgId, user.id, body);
	}

	@Patch(":id")
	async update(
		@Param("id") channelId: string,
		@Session() { user, session }: UserSession,
		@Body() body: UpdateChannelDto,
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		return this.channelsService.updateChannel(
			channelId,
			user.id,
			orgRole,
			body,
		);
	}

	@Delete(":id")
	async remove(
		@Param("id") channelId: string,
		@Session() { user, session }: UserSession,
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		await this.channelsService.deleteChannel(channelId, user.id, orgRole);
		return { deleted: true };
	}

	@Post(":id/members")
	async addMember(
		@Param("id") channelId: string,
		@Session() { user, session }: UserSession,
		@Body() body: AddChannelMemberDto,
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		return this.channelsService.addMember(
			channelId,
			user.id,
			orgRole,
			body.userId,
		);
	}

	@Delete(":id/members/:userId")
	async removeMember(
		@Param("id") channelId: string,
		@Param("userId") targetUserId: string,
		@Session() { user, session }: UserSession,
	) {
		const orgId = this.requireOrgId(session);
		const orgRole = await this.channelsService.getOrgRole(user.id, orgId);
		await this.channelsService.removeMember(
			channelId,
			user.id,
			orgRole,
			targetUserId,
		);
		return { removed: true };
	}

	private requireOrgId(session: { activeOrganizationId?: string | null }): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
