import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";

@Injectable()
export class PresenceService {
	// Map<roomId, Map<userId, timeout handle>>
	private readonly typingTimers = new Map<
		string,
		Map<string, NodeJS.Timeout>
	>();

	constructor(@Inject(DB) private readonly db: Db) {}

	// ── Typing ─────────────────────────────────────────────────────────────────

	/**
	 * Mark a user as typing in a room. Calls `onAutoStop` after 5 s of silence.
	 * Resets the timer if called again before it fires.
	 */
	setTyping(roomId: string, userId: string, onAutoStop: () => void): void {
		let roomMap = this.typingTimers.get(roomId);
		if (!roomMap) {
			roomMap = new Map();
			this.typingTimers.set(roomId, roomMap);
		}

		const existing = roomMap.get(userId);
		if (existing) clearTimeout(existing);

		const timer = setTimeout(() => {
			roomMap!.delete(userId);
			if (roomMap!.size === 0) this.typingTimers.delete(roomId);
			onAutoStop();
		}, 5000);

		roomMap.set(userId, timer);
	}

	/**
	 * Explicitly stop typing. Returns `true` if there was an active timer.
	 */
	stopTyping(roomId: string, userId: string): boolean {
		const roomMap = this.typingTimers.get(roomId);
		if (!roomMap?.has(userId)) return false;

		clearTimeout(roomMap.get(userId));
		roomMap.delete(userId);
		if (roomMap.size === 0) this.typingTimers.delete(roomId);
		return true;
	}

	/**
	 * Clear all typing timers for a user across every room.
	 * Returns the list of roomIds that had active timers.
	 */
	clearAllTypingForUser(userId: string): string[] {
		const affectedRooms: string[] = [];
		for (const [roomId, roomMap] of this.typingTimers) {
			if (roomMap.has(userId)) {
				clearTimeout(roomMap.get(userId));
				roomMap.delete(userId);
				if (roomMap.size === 0) this.typingTimers.delete(roomId);
				affectedRooms.push(roomId);
			}
		}
		return affectedRooms;
	}

	// ── Presence DB ────────────────────────────────────────────────────────────

	async upsertPresence(
		userId: string,
		orgId: string,
		status: string,
		customStatus?: string | null,
		customStatusEmoji?: string | null,
	) {
		await this.db
			.insert(schema.userPresence)
			.values({
				userId,
				organizationId: orgId,
				status,
				customStatus: customStatus ?? null,
				customStatusEmoji: customStatusEmoji ?? null,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [
					schema.userPresence.userId,
					schema.userPresence.organizationId,
				],
				set: {
					status,
					customStatus: customStatus ?? null,
					customStatusEmoji: customStatusEmoji ?? null,
					updatedAt: new Date(),
				},
			});

		return this.db.query.userPresence.findFirst({
			where: and(
				eq(schema.userPresence.userId, userId),
				eq(schema.userPresence.organizationId, orgId),
			),
		});
	}

	async setOffline(userId: string, orgId: string) {
		await this.db
			.insert(schema.userPresence)
			.values({
				userId,
				organizationId: orgId,
				status: "offline",
				lastSeenAt: new Date(),
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [
					schema.userPresence.userId,
					schema.userPresence.organizationId,
				],
				set: {
					status: "offline",
					lastSeenAt: new Date(),
					updatedAt: new Date(),
				},
			});
	}
}
