import { randomUUID } from "node:crypto";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";

type OrgRole = "owner" | "admin" | "member";

@Injectable()
export class ChannelsService {
	constructor(@Inject(DB) private readonly db: Db) {}

	// ── Queries ────────────────────────────────────────────────────────────────

	async listChannels(orgId: string, userId: string) {
		// Public channels in org
		const publicChannels = await this.db.query.channel.findMany({
			where: and(
				eq(schema.channel.organizationId, orgId),
				eq(schema.channel.isPrivate, false),
			),
			orderBy: [asc(schema.channel.name)],
		});

		// Private channels the user is a member of (join)
		const privateRows = await this.db
			.select({ channel: schema.channel })
			.from(schema.channel)
			.innerJoin(
				schema.channelMember,
				and(
					eq(schema.channelMember.channelId, schema.channel.id),
					eq(schema.channelMember.userId, userId),
				),
			)
			.where(
				and(
					eq(schema.channel.organizationId, orgId),
					eq(schema.channel.isPrivate, true),
				),
			)
			.orderBy(asc(schema.channel.name));

		return [...publicChannels, ...privateRows.map((r) => r.channel)];
	}

	async getChannel(channelId: string, orgId: string) {
		const ch = await this.db.query.channel.findFirst({
			where: and(
				eq(schema.channel.id, channelId),
				eq(schema.channel.organizationId, orgId),
			),
		});
		if (!ch) throw new NotFoundException("Channel not found");
		return ch;
	}

	// ── Mutations ──────────────────────────────────────────────────────────────

	async createChannel(
		orgId: string,
		userId: string,
		dto: { name: string; description?: string; isPrivate?: boolean },
	) {
		const id = randomUUID();
		const now = new Date();
		const isPrivate = dto.isPrivate ?? false;

		await this.db.insert(schema.channel).values({
			id,
			organizationId: orgId,
			name: dto.name,
			description: dto.description ?? null,
			isPrivate,
			createdBy: userId,
			createdAt: now,
			updatedAt: now,
		});

		if (isPrivate) {
			await this.db.insert(schema.channelMember).values({
				id: randomUUID(),
				channelId: id,
				userId,
				role: "owner",
				joinedAt: now,
			});
		}

		return this.db.query.channel.findFirst({
			where: eq(schema.channel.id, id),
		});
	}

	async updateChannel(
		channelId: string,
		userId: string,
		orgRole: OrgRole,
		dto: { name?: string; description?: string },
	) {
		const ch = await this.db.query.channel.findFirst({
			where: eq(schema.channel.id, channelId),
		});
		if (!ch) throw new NotFoundException("Channel not found");

		await this.assertCanManageChannel(ch, userId, orgRole);

		await this.db
			.update(schema.channel)
			.set({ ...dto, updatedAt: new Date() })
			.where(eq(schema.channel.id, channelId));

		return this.db.query.channel.findFirst({
			where: eq(schema.channel.id, channelId),
		});
	}

	async deleteChannel(channelId: string, userId: string, orgRole: OrgRole) {
		const ch = await this.db.query.channel.findFirst({
			where: eq(schema.channel.id, channelId),
		});
		if (!ch) throw new NotFoundException("Channel not found");

		await this.assertCanManageChannel(ch, userId, orgRole);

		await this.db
			.delete(schema.channel)
			.where(eq(schema.channel.id, channelId));
	}

	async addMember(
		channelId: string,
		userId: string,
		orgRole: OrgRole,
		targetUserId: string,
	) {
		const ch = await this.db.query.channel.findFirst({
			where: eq(schema.channel.id, channelId),
		});
		if (!ch) throw new NotFoundException("Channel not found");

		await this.assertCanManageChannel(ch, userId, orgRole);

		const existing = await this.db.query.channelMember.findFirst({
			where: and(
				eq(schema.channelMember.channelId, channelId),
				eq(schema.channelMember.userId, targetUserId),
			),
		});
		if (existing) return existing;

		const record = {
			id: randomUUID(),
			channelId,
			userId: targetUserId,
			role: "member" as const,
			joinedAt: new Date(),
		};
		await this.db.insert(schema.channelMember).values(record);
		return record;
	}

	async removeMember(
		channelId: string,
		userId: string,
		orgRole: OrgRole,
		targetUserId: string,
	) {
		const ch = await this.db.query.channel.findFirst({
			where: eq(schema.channel.id, channelId),
		});
		if (!ch) throw new NotFoundException("Channel not found");

		await this.assertCanManageChannel(ch, userId, orgRole);

		await this.db
			.delete(schema.channelMember)
			.where(
				and(
					eq(schema.channelMember.channelId, channelId),
					eq(schema.channelMember.userId, targetUserId),
				),
			);
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	async getOrgRole(userId: string, orgId: string): Promise<OrgRole> {
		const m = await this.db.query.member.findFirst({
			where: and(
				eq(schema.member.userId, userId),
				eq(schema.member.organizationId, orgId),
			),
		});
		return (m?.role as OrgRole) ?? "member";
	}

	private async assertCanManageChannel(
		ch: typeof schema.channel.$inferSelect,
		userId: string,
		orgRole: OrgRole,
	) {
		if (orgRole === "owner" || orgRole === "admin") return;

		if (!ch.isPrivate) {
			if (ch.createdBy === userId) return;
			throw new ForbiddenException("Not authorised to manage this channel");
		}

		const membership = await this.db.query.channelMember.findFirst({
			where: and(
				eq(schema.channelMember.channelId, ch.id),
				eq(schema.channelMember.userId, userId),
			),
		});
		if (membership?.role === "owner") return;
		throw new ForbiddenException("Not authorised to manage this channel");
	}
}
