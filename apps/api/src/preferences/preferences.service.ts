import { Inject, Injectable } from "@nestjs/common";
import { type UpdateUserPreferencesInput } from "@orbit/shared";
import { eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";

@Injectable()
export class PreferencesService {
	constructor(@Inject(DB) private readonly db: Db) {}

	async getPreferences(userId: string) {
		const row = await this.db.query.userPreferences.findFirst({
			where: eq(schema.userPreferences.userId, userId),
		});
		return row ?? null;
	}

	async upsertPreferences(userId: string, data: UpdateUserPreferencesInput) {
		const [row] = await this.db
			.insert(schema.userPreferences)
			.values({ userId, ...data })
			.onConflictDoUpdate({
				target: schema.userPreferences.userId,
				set: { ...data, updatedAt: new Date() },
			})
			.returning();
		return row;
	}
}
