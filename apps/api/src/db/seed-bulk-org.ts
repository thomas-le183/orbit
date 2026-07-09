import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());
expand(config({ path: "../../.env" }));

import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
	ensureOrgDefaults,
	pickDefaultStatusId,
} from "../projects/org-defaults";
import * as schema from "./schema";

/**
 * Add bulk load-test data to an existing org: N users (org members) plus one
 * project whose tasks span a full year.
 *
 *   bun src/db/seed-bulk-org.ts [orgSlug] [userCount] [taskCount]
 *
 * Defaults: acme-corp, 100 users, 10000 tasks. Additive and re-runnable —
 * users are keyed by a stable email so a second run reuses them.
 */
const ORG_SLUG = process.argv[2] ?? "acme-corp";
const USER_COUNT = Number(process.argv[3] ?? 100);
const TASK_COUNT = Number(process.argv[4] ?? 10_000);

const PASSWORD = "orbit";
const CHUNK = 500;
const DAY = 86_400_000;
const YEAR_DAYS = 365;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const colors = [
	"#6366f1",
	"#ec4899",
	"#f59e0b",
	"#10b981",
	"#3b82f6",
	"#ef4444",
];
const priorities = ["none", "low", "medium", "high", "urgent"];

const email = (i: number) => `loadtest${i + 1}@orbit.com`;

async function insertChunked<T>(
	rows: T[],
	insert: (batch: T[]) => Promise<unknown>,
) {
	for (let i = 0; i < rows.length; i += CHUNK) {
		await insert(rows.slice(i, i + CHUNK));
	}
}

async function run() {
	const db = drizzle(process.env.DATABASE_URL!, { schema });

	const org = await db.query.organization.findFirst({
		where: eq(schema.organization.slug, ORG_SLUG),
		columns: { id: true, name: true },
	});
	if (!org)
		throw new Error(`Org "${ORG_SLUG}" not found. Run pnpm db:seed:dev first.`);

	await ensureOrgDefaults(db, org.id);

	// ── Users ─────────────────────────────────────────────────────
	// Reuse any loadtest users that already exist so re-runs stay additive.
	const emails = Array.from({ length: USER_COUNT }, (_, i) => email(i));
	const existingUsers = await db.query.user.findMany({
		where: inArray(schema.user.email, emails),
		columns: { id: true, email: true },
	});
	const byEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

	const newUsers = emails
		.filter((e) => !byEmail.has(e))
		.map((e, i) => ({
			id: randomUUID(),
			email: e,
			index: existingUsers.length + i,
		}));

	if (newUsers.length > 0) {
		const password = await hashPassword(PASSWORD);
		const now = new Date();

		await insertChunked(newUsers, (batch) =>
			db.insert(schema.user).values(
				batch.map((u) => ({
					id: u.id,
					name: `Load Test User ${u.index + 1}`,
					email: u.email,
					emailVerified: true,
					createdAt: now,
					updatedAt: now,
				})),
			),
		);

		await insertChunked(newUsers, (batch) =>
			db.insert(schema.account).values(
				batch.map((u) => ({
					id: randomUUID(),
					userId: u.id,
					accountId: u.id,
					providerId: "credential",
					password,
					createdAt: now,
					updatedAt: now,
				})),
			),
		);

		for (const u of newUsers) byEmail.set(u.email, u.id);
	}

	const userIds = emails.map((e) => byEmail.get(e)!);

	// ── Org membership ────────────────────────────────────────────
	const existingMembers = await db.query.member.findMany({
		where: eq(schema.member.organizationId, org.id),
		columns: { userId: true, role: true },
	});
	const memberUserIds = new Set(existingMembers.map((m) => m.userId));

	const newMembers = userIds
		.filter((id) => !memberUserIds.has(id))
		.map((userId) => ({
			id: randomUUID(),
			organizationId: org.id,
			userId,
			role: "member",
			createdAt: new Date(),
		}));

	await insertChunked(newMembers, (batch) =>
		db.insert(schema.member).values(batch),
	);

	// The project owner must be a pre-existing org owner, not a load-test user.
	const owner = existingMembers.find((m) => m.role === "owner");
	if (!owner)
		throw new Error(`Org "${ORG_SLUG}" has no owner to attribute records to.`);
	const createdBy = owner.userId;

	// ── Project ───────────────────────────────────────────────────
	const taskStatuses = await db.query.taskStatus.findMany({
		where: eq(schema.taskStatus.organizationId, org.id),
		columns: { id: true },
	});
	const projectStatuses = await db.query.projectStatus.findMany({
		where: eq(schema.projectStatus.organizationId, org.id),
		columns: { id: true, type: true, position: true },
	});
	if (taskStatuses.length === 0)
		throw new Error(`No task statuses for org ${org.id}.`);
	const statusIds = taskStatuses.map((s) => s.id);
	const projectStatusId = pickDefaultStatusId(projectStatuses, "execution");

	// Year window centered on today so the timeline has past and future work.
	const start = Date.now() - (YEAR_DAYS / 2) * DAY;
	const projectId = randomUUID();
	const projectName = `Load Test ${new Date().toISOString().slice(0, 16)}`;

	await db.insert(schema.project).values({
		id: projectId,
		organizationId: org.id,
		name: projectName,
		description: `${TASK_COUNT} tasks across ${USER_COUNT} assignees over one year.`,
		statusId: projectStatusId,
		color: "#6366f1",
		startDate: iso(start),
		endDate: iso(start + YEAR_DAYS * DAY),
		createdBy,
	});

	// ── Tasks ─────────────────────────────────────────────────────
	const rows: (typeof schema.task.$inferInsert)[] = Array.from(
		{ length: TASK_COUNT },
		(_, i) => {
			const startOffset = Math.floor(Math.random() * YEAR_DAYS);
			const durationDays = 1 + Math.floor(Math.random() * 14);
			const taskStart = start + startOffset * DAY;
			return {
				id: randomUUID(),
				projectId,
				name: `Task ${i + 1}`,
				statusId: statusIds[i % statusIds.length],
				priority: priorities[i % priorities.length],
				progress: Math.floor(Math.random() * 101),
				startDate: iso(taskStart),
				endDate: iso(taskStart + (durationDays - 1) * DAY),
				color: colors[i % colors.length],
				assigneeId: userIds[i % userIds.length],
				position: i,
				createdBy,
			};
		},
	);

	let inserted = 0;
	await insertChunked(rows, async (batch) => {
		await db.insert(schema.task).values(batch);
		inserted += batch.length;
		console.log(`  inserted ${inserted}/${rows.length} tasks`);
	});

	console.log(`\nSeeded org "${org.name}" (${ORG_SLUG}):`);
	console.log(
		`  ${newUsers.length} new users (${USER_COUNT} total, password: "${PASSWORD}")`,
	);
	console.log(`  ${newMembers.length} new org members`);
	console.log(`  project "${projectName}" (${projectId})`);
	console.log(
		`  ${rows.length} tasks from ${iso(start)} to ${iso(start + YEAR_DAYS * DAY)}`,
	);
}

run()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
