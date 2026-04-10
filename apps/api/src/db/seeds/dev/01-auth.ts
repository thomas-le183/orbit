import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { reset } from "drizzle-seed";
import type { Db } from "../../db.module";
import * as schema from "../../schema";

const USERS = [
	{ name: "Dev User", email: "dev@orbit.local" },
	{ name: "Alice Chen", email: "alice@orbit.local" },
	{ name: "Bob Kim", email: "bob@orbit.local" },
	{ name: "Carol Singh", email: "carol@orbit.local" },
	{ name: "Dan Park", email: "dan@orbit.local" },
	{ name: "Eve Torres", email: "eve@orbit.local" },
	{ name: "Frank Wu", email: "frank@orbit.local" },
];

const ORGS = [
	{ name: "Orbit Dev", slug: "orbit-dev" },
	{ name: "Acme Corp", slug: "acme-corp" },
	{ name: "Stellar Labs", slug: "stellar-labs" },
];

// Each org: [ownerIndex, member1Index, member2Index]
const ORG_MEMBERS: [number, number, number][] = [
	[0, 1, 2],
	[3, 4, 0],
	[5, 6, 0],
];

export async function seedAuth(db: Db) {
	const password = await hashPassword("orbit");

	await reset(db, schema);

	// ── Users ──────────────────────────────────────────────────────
	const userIds = USERS.map(() => randomUUID());

	await db.insert(schema.user).values(
		USERS.map((u, i) => ({
			id: userIds[i],
			name: u.name,
			email: u.email,
			emailVerified: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
	);

	await db.insert(schema.account).values(
		USERS.map((_, i) => ({
			id: randomUUID(),
			userId: userIds[i],
			accountId: userIds[i],
			providerId: "credential",
			password,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
	);

	console.log(`  users (all password: "orbit")`);
	for (const [i, u] of USERS.entries()) {
		console.log(`    ${userIds[i]}  ${u.email}`);
	}

	// ── Orgs + members ────────────────────────────────────────────
	for (const [orgIdx, org] of ORGS.entries()) {
		const orgId = randomUUID();

		await db.insert(schema.organization).values({
			id: orgId,
			name: org.name,
			slug: org.slug,
			createdAt: new Date(),
		});

		const [ownerIdx, m1Idx, m2Idx] = ORG_MEMBERS[orgIdx];

		await db.insert(schema.member).values([
			{
				id: randomUUID(),
				organizationId: orgId,
				userId: userIds[ownerIdx],
				role: "owner",
				createdAt: new Date(),
			},
			{
				id: randomUUID(),
				organizationId: orgId,
				userId: userIds[m1Idx],
				role: "member",
				createdAt: new Date(),
			},
			{
				id: randomUUID(),
				organizationId: orgId,
				userId: userIds[m2Idx],
				role: "member",
				createdAt: new Date(),
			},
		]);

		console.log(
			`  org  ${orgId}  ${org.slug}  (owner: ${USERS[ownerIdx].email}, members: ${USERS[m1Idx].email}, ${USERS[m2Idx].email})`,
		);
	}
}
