import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";

const PAGE_SIZE = 30;

@Injectable()
export class NotificationService {
	constructor(@Inject(DB) private readonly db: Db) {}

	async list(userId: string) {
		return this.db.query.notification.findMany({
			where: eq(schema.notification.userId, userId),
			orderBy: [desc(schema.notification.createdAt)],
			limit: PAGE_SIZE,
		});
	}

	async getUnreadCount(userId: string): Promise<number> {
		const result = await this.db
			.select({ value: count() })
			.from(schema.notification)
			.where(
				and(
					eq(schema.notification.userId, userId),
					eq(schema.notification.read, false),
				),
			);
		return result[0]?.value ?? 0;
	}

	async markRead(notificationId: string): Promise<void> {
		await this.db
			.update(schema.notification)
			.set({ read: true })
			.where(eq(schema.notification.id, notificationId));
	}

	async markAllRead(userId: string): Promise<void> {
		await this.db
			.update(schema.notification)
			.set({ read: true })
			.where(eq(schema.notification.userId, userId));
	}
}
