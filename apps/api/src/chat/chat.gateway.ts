import { Inject } from "@nestjs/common";
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
	WsException,
} from "@nestjs/websockets";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import type { Server, Socket } from "socket.io";
import {
	AUTH,
	type Auth,
	type Session,
	type User,
} from "../auth/auth.constants";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { MessagesService } from "./messages/messages.service";
import { PresenceService } from "./presence/presence.service";

interface AuthenticatedSocket extends Socket {
	data: {
		user: User;
		session: Session;
	};
}

@WebSocketGateway({
	cors: {
		origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [],
		credentials: true,
	},
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer() private readonly server!: Server;

	constructor(
		@Inject(AUTH) private readonly auth: Auth,
		@Inject(DB) private readonly db: Db,
		private readonly messagesService: MessagesService,
		private readonly presenceService: PresenceService,
	) {}

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	async handleConnection(socket: AuthenticatedSocket) {
		const result = await this.auth.api.getSession({
			headers: fromNodeHeaders(socket.handshake.headers),
		});

		if (!result) {
			socket.disconnect();
			return;
		}

		socket.data.user = result.user as User;
		socket.data.session = result.session as unknown as Session;

		const orgId = socket.data.session.activeOrganizationId;
		if (!orgId) return;

		await socket.join(`org:${orgId}`);
		await this.presenceService.upsertPresence(result.user.id, orgId, "online");
		this.server.to(`org:${orgId}`).emit("presence:update", {
			userId: result.user.id,
			status: "online",
			customStatus: null,
			customStatusEmoji: null,
		});
	}

	async handleDisconnect(socket: AuthenticatedSocket) {
		const { user, session } = socket.data ?? {};
		if (!user || !session?.activeOrganizationId) return;

		const orgId = session.activeOrganizationId;

		// Clear any active typing indicators and notify affected rooms
		const typingRooms = this.presenceService.clearAllTypingForUser(user.id);
		for (const roomId of typingRooms) {
			this.server
				.to(roomId)
				.emit("typing:update", { roomId, userId: user.id, isTyping: false });
		}

		await this.presenceService.setOffline(user.id, orgId);
		this.server.to(`org:${orgId}`).emit("presence:update", {
			userId: user.id,
			status: "offline",
			customStatus: null,
			customStatusEmoji: null,
		});
	}

	// ── Room management ────────────────────────────────────────────────────────

	@SubscribeMessage("room:join")
	async onRoomJoin(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { roomId: string },
	) {
		const { user, session } = socket.data;
		const orgId = session.activeOrganizationId;
		if (!orgId) throw new WsException("No active organization");

		await this.assertRoomAccess(payload.roomId, user.id, orgId);
		await socket.join(payload.roomId);
		return { joined: payload.roomId };
	}

	@SubscribeMessage("room:leave")
	async onRoomLeave(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { roomId: string },
	) {
		await socket.leave(payload.roomId);
		return { left: payload.roomId };
	}

	// ── Messaging ──────────────────────────────────────────────────────────────

	@SubscribeMessage("message:send")
	async onMessageSend(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody()
		payload: {
			roomId: string;
			content: string;
			parentMessageId?: string;
			storageKeys?: string[];
		},
	) {
		const { user, session } = socket.data;
		const orgId = session.activeOrganizationId;
		if (!orgId) throw new WsException("No active organization");

		// Validate storageKey ownership — keys must be namespaced to this user
		for (const key of payload.storageKeys ?? []) {
			if (!key.startsWith(`${user.id}/`)) {
				throw new WsException(`Invalid storageKey: ${key}`);
			}
		}

		const { channelId, conversationId } = this.parseRoomId(payload.roomId);

		const message = await this.messagesService.createMessage({
			channelId,
			conversationId,
			senderId: user.id,
			content: payload.content,
			parentMessageId: payload.parentMessageId,
			storageKeys: payload.storageKeys,
		});

		this.server.to(payload.roomId).emit("message:new", message);
		return message;
	}

	@SubscribeMessage("message:edit")
	async onMessageEdit(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { messageId: string; content: string },
	) {
		const { user, session } = socket.data;
		const orgRole = await this.getOrgRole(
			user.id,
			session.activeOrganizationId,
		);

		const updated = await this.messagesService.editMessage(
			payload.messageId,
			user.id,
			orgRole,
			payload.content,
		);

		const roomId = await this.getRoomIdForMessage(payload.messageId);
		if (roomId) {
			this.server.to(roomId).emit("message:updated", {
				messageId: payload.messageId,
				content: payload.content,
				updatedAt: updated?.updatedAt,
			});
		}

		return updated;
	}

	@SubscribeMessage("message:delete")
	async onMessageDelete(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { messageId: string },
	) {
		const { user, session } = socket.data;
		const orgRole = await this.getOrgRole(
			user.id,
			session.activeOrganizationId,
		);
		const roomId = await this.getRoomIdForMessage(payload.messageId);

		await this.messagesService.softDeleteMessage(
			payload.messageId,
			user.id,
			orgRole,
		);

		if (roomId) {
			this.server
				.to(roomId)
				.emit("message:deleted", { messageId: payload.messageId });
		}

		return { deleted: true };
	}

	// ── Reactions ──────────────────────────────────────────────────────────────

	@SubscribeMessage("reaction:toggle")
	async onReactionToggle(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { messageId: string; emoji: string },
	) {
		const reactions = await this.messagesService.toggleReaction(
			payload.messageId,
			socket.data.user.id,
			payload.emoji,
		);

		const roomId = await this.getRoomIdForMessage(payload.messageId);
		if (roomId) {
			this.server
				.to(roomId)
				.emit("reaction:updated", { messageId: payload.messageId, reactions });
		}

		return { reactions };
	}

	// ── Typing ─────────────────────────────────────────────────────────────────

	@SubscribeMessage("typing:start")
	onTypingStart(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { roomId: string },
	) {
		const userId = socket.data.user.id;

		this.presenceService.setTyping(payload.roomId, userId, () => {
			// Auto-stop after 5 s
			socket.to(payload.roomId).emit("typing:update", {
				roomId: payload.roomId,
				userId,
				isTyping: false,
			});
		});

		socket.to(payload.roomId).emit("typing:update", {
			roomId: payload.roomId,
			userId,
			isTyping: true,
		});
	}

	@SubscribeMessage("typing:stop")
	onTypingStop(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody() payload: { roomId: string },
	) {
		const userId = socket.data.user.id;
		const wasTyping = this.presenceService.stopTyping(payload.roomId, userId);

		if (wasTyping) {
			socket.to(payload.roomId).emit("typing:update", {
				roomId: payload.roomId,
				userId,
				isTyping: false,
			});
		}
	}

	// ── Presence ───────────────────────────────────────────────────────────────

	@SubscribeMessage("presence:status")
	async onPresenceStatus(
		@ConnectedSocket() socket: AuthenticatedSocket,
		@MessageBody()
		payload: {
			status: string;
			customStatus?: string | null;
			customStatusEmoji?: string | null;
		},
	) {
		const { user, session } = socket.data;
		const orgId = session.activeOrganizationId;
		if (!orgId) throw new WsException("No active organization");

		await this.presenceService.upsertPresence(
			user.id,
			orgId,
			payload.status,
			payload.customStatus,
			payload.customStatusEmoji,
		);

		this.server.to(`org:${orgId}`).emit("presence:update", {
			userId: user.id,
			status: payload.status,
			customStatus: payload.customStatus ?? null,
			customStatusEmoji: payload.customStatusEmoji ?? null,
		});
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private parseRoomId(roomId: string): {
		channelId?: string;
		conversationId?: string;
	} {
		if (roomId.startsWith("channel:")) {
			return { channelId: roomId.slice("channel:".length) };
		}
		if (roomId.startsWith("conversation:")) {
			return { conversationId: roomId.slice("conversation:".length) };
		}
		throw new WsException(`Invalid roomId format: ${roomId}`);
	}

	private async assertRoomAccess(
		roomId: string,
		userId: string,
		orgId: string,
	) {
		if (roomId.startsWith("channel:")) {
			const channelId = roomId.slice("channel:".length);
			const channel = await this.db.query.channel.findFirst({
				where: and(
					eq(schema.channel.id, channelId),
					eq(schema.channel.organizationId, orgId),
				),
			});
			if (!channel) throw new WsException("Channel not found");

			if (channel.isPrivate) {
				const membership = await this.db.query.channelMember.findFirst({
					where: and(
						eq(schema.channelMember.channelId, channelId),
						eq(schema.channelMember.userId, userId),
					),
				});
				if (!membership) throw new WsException("Not a member of this channel");
			}
			return;
		}

		if (roomId.startsWith("conversation:")) {
			const conversationId = roomId.slice("conversation:".length);
			const participant = await this.db.query.conversationParticipant.findFirst(
				{
					where: and(
						eq(schema.conversationParticipant.conversationId, conversationId),
						eq(schema.conversationParticipant.userId, userId),
					),
				},
			);
			if (!participant) throw new WsException("Not a participant");
			return;
		}

		throw new WsException(`Invalid roomId format: ${roomId}`);
	}

	private async getRoomIdForMessage(messageId: string): Promise<string | null> {
		const msg = await this.db.query.message.findFirst({
			where: eq(schema.message.id, messageId),
		});
		if (!msg) return null;
		if (msg.channelId) return `channel:${msg.channelId}`;
		if (msg.conversationId) return `conversation:${msg.conversationId}`;
		return null;
	}

	private async getOrgRole(
		userId: string,
		orgId: string | null | undefined,
	): Promise<string> {
		if (!orgId) return "member";
		const m = await this.db.query.member.findFirst({
			where: and(
				eq(schema.member.userId, userId),
				eq(schema.member.organizationId, orgId),
			),
		});
		return m?.role ?? "member";
	}
}
