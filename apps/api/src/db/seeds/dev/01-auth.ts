import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Db } from "../../db.module";
import * as schema from "../../schema";

export async function seedAuth(db: Db) {
	const userId = randomUUID();
	const orgId = randomUUID();

	await db.insert(schema.user).values({
		id: userId,
		name: "Dev User",
		email: "dev@orbit.local",
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	console.log(`  user          ${userId}  dev@orbit.local`);

	await db.insert(schema.account).values({
		id: randomUUID(),
		userId,
		accountId: userId,
		providerId: "credential",
		password: await hashPassword("password"),
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	console.log(`  account       credential  (password: "password")`);

	await db.insert(schema.organization).values({
		id: orgId,
		name: "Orbit Dev",
		slug: "orbit-dev",
		createdAt: new Date(),
	});

	console.log(`  organization  ${orgId}  orbit-dev`);

	await db.insert(schema.member).values({
		id: randomUUID(),
		userId,
		organizationId: orgId,
		role: "owner",
		createdAt: new Date(),
	});

	console.log(`  member        userId=${userId}  role=owner`);
}
