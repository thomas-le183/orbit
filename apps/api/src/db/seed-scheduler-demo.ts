import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());
expand(config({ path: "../../.env" }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ensureOrgDefaults } from "../projects/org-defaults";
import * as schema from "./schema";

/**
 * Seed a fresh project with assignee-distributed, overlapping tasks so the
 * scheduler view has multiple assignee rows, each packing into several lanes.
 *
 *   bun src/db/seed-scheduler-demo.ts [orgSlug] [projectName]
 *
 * Defaults: org "acme-corp", project "Scheduler Demo <timestamp>".
 */
const ORG_SLUG = process.argv[2] ?? "acme-corp";
const PROJECT_NAME =
	process.argv[3] ?? `Scheduler Demo ${new Date().toISOString().slice(0, 16)}`;

const DAY = 86_400_000;
const TODAY = Date.now();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

/** Overlapping [startOffsetDays, durationDays] windows — forces lane stacking. */
const WINDOWS: [number, number][] = [
	[-21, 9],
	[-16, 12],
	[-12, 7],
	[-6, 14],
	[-2, 8],
	[2, 10],
	[7, 13],
	[13, 6],
];

async function run() {
	const db = drizzle(process.env.DATABASE_URL!, { schema });

	const org = await db.query.organization.findFirst({
		where: eq(schema.organization.slug, ORG_SLUG),
		columns: { id: true, name: true },
	});
	if (!org) throw new Error(`Org "${ORG_SLUG}" not found.`);

	const members = await db.query.member.findMany({
		where: eq(schema.member.organizationId, org.id),
		columns: { userId: true, role: true },
	});
	if (members.length === 0) throw new Error(`Org "${ORG_SLUG}" has no members.`);

	const owner = members.find((m) => m.role === "owner") ?? members[0];
	const createdBy = owner.userId;
	const assigneeIds = members.map((m) => m.userId);

	await ensureOrgDefaults(db, org.id);

	const taskStatuses = await db.query.taskStatus.findMany({
		where: eq(schema.taskStatus.organizationId, org.id),
		columns: { id: true },
	});
	const projectStatuses = await db.query.projectStatus.findMany({
		where: eq(schema.projectStatus.organizationId, org.id),
		columns: { id: true, type: true, position: true },
	});
	const statusIds = taskStatuses.map((s) => s.id);
	const projectStatusId =
		[...projectStatuses]
			.sort((a, b) => a.position - b.position)
			.find((s) => s.type === "execution")?.id ?? projectStatuses[0]?.id;
	if (!projectStatusId) throw new Error(`No project statuses for org ${org.id}.`);

	// ── Project ───────────────────────────────────────────────────
	const projectId = randomUUID();
	await db.insert(schema.project).values({
		id: projectId,
		organizationId: org.id,
		name: PROJECT_NAME,
		description: "Demo project for the scheduler view (assignee lanes).",
		statusId: projectStatusId,
		color: "#6366f1",
		startDate: iso(TODAY - 30 * DAY),
		endDate: iso(TODAY + 30 * DAY),
		createdBy,
	});

	// ── Tasks: one overlapping block per assignee, plus unassigned ──
	type Row = typeof schema.task.$inferInsert;
	const rows: Row[] = [];
	let position = 0;

	// Assignee groups — phase-shift each so their blocks differ a little.
	assigneeIds.forEach((assigneeId, ai) => {
		WINDOWS.forEach(([startOff, dur], wi) => {
			const start = TODAY + (startOff + ai * 2) * DAY;
			rows.push({
				id: randomUUID(),
				projectId,
				name: `Task ${ai + 1}.${wi + 1}`,
				statusId: statusIds[(ai + wi) % statusIds.length],
				priority: "none",
				progress: Math.floor(Math.random() * 101),
				startDate: iso(start),
				endDate: iso(start + (dur - 1) * DAY),
				color: colors[(ai + wi) % colors.length],
				assigneeId,
				position: position++,
				createdBy,
			});
		});
	});

	// A handful of unassigned tasks → renders the trailing "Unassigned" row.
	WINDOWS.slice(0, 5).forEach(([startOff, dur], wi) => {
		const start = TODAY + startOff * DAY;
		rows.push({
			id: randomUUID(),
			projectId,
			name: `Unassigned ${wi + 1}`,
			statusId: statusIds[wi % statusIds.length],
			priority: "none",
			progress: Math.floor(Math.random() * 101),
			startDate: iso(start),
			endDate: iso(start + (dur - 1) * DAY),
			color: colors[wi % colors.length],
			assigneeId: null,
			position: position++,
			createdBy,
		});
	});

	await db.insert(schema.task).values(rows);

	// ── Milestones ────────────────────────────────────────────────
	const milestoneDefs: [string, number, string][] = [
		["Kickoff", -18, "#10b981"],
		["Mid-sprint review", 0, "#f59e0b"],
		["Launch", 21, "#ef4444"],
	];
	await db.insert(schema.milestone).values(
		milestoneDefs.map(([name, off, color], i) => ({
			id: randomUUID(),
			projectId,
			name,
			date: iso(TODAY + off * DAY),
			color,
			position: i,
			createdBy,
		})),
	);

	console.log(
		`\nSeeded "${PROJECT_NAME}" (${projectId}) in org "${org.name}" (${ORG_SLUG}):`,
	);
	console.log(`  ${rows.length} tasks across ${assigneeIds.length} assignees + unassigned`);
	console.log(`  ${milestoneDefs.length} milestones`);
	console.log(`\nOpen the project and switch to the scheduler view to test.`);
}

run()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
