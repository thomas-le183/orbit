import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());
expand(config({ path: "../../.env" }));

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ensureOrgDefaults } from "../projects/org-defaults";
import * as schema from "./schema";

/** How many tasks to create. Override with: bun src/db/seed-bulk-tasks.ts 5000 */
const COUNT = Number(process.argv[2] ?? 2000);
/** Optional project id to target. Defaults to a random project. */
const TARGET_PROJECT_ID = process.argv[3];

const CHUNK = 500;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function run() {
	const db = drizzle(process.env.DATABASE_URL!, { schema });

	const projects = await db.query.project.findMany({
		columns: { id: true, name: true, organizationId: true, createdBy: true },
	});
	if (projects.length === 0) {
		throw new Error("No projects found — seed a project first (pnpm db:seed:dev).");
	}

	const project = TARGET_PROJECT_ID
		? projects.find((p) => p.id === TARGET_PROJECT_ID)
		: projects[Math.floor(Math.random() * projects.length)];
	if (!project) throw new Error(`Project ${TARGET_PROJECT_ID} not found.`);

	const orgId = project.organizationId;
	await ensureOrgDefaults(db, orgId);

	const statuses = await db.query.taskStatus.findMany({
		where: eq(schema.taskStatus.organizationId, orgId),
		columns: { id: true },
	});
	if (statuses.length === 0) {
		throw new Error(`No task statuses for org ${orgId}.`);
	}
	const statusIds = statuses.map((s) => s.id);

	// Continue positions after any existing tasks so ordering stays stable.
	const existing = await db.query.task.findMany({
		where: eq(schema.task.projectId, project.id),
		columns: { id: true },
	});
	const basePosition = existing.length;

	const today = Date.now();
	const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

	const rows = Array.from({ length: COUNT }, (_, i) => {
		// Spread starts across ±180 days of today so the timeline is densely filled.
		const startOffset = Math.floor(Math.random() * 361) - 180;
		const durationDays = 1 + Math.floor(Math.random() * 14);
		const start = today + startOffset * DAY;
		return {
			id: randomUUID(),
			projectId: project.id,
			name: `Load test task ${basePosition + i + 1}`,
			statusId: statusIds[i % statusIds.length],
			priority: "none",
			progress: Math.floor(Math.random() * 101),
			startDate: iso(start),
			endDate: iso(start + (durationDays - 1) * DAY),
			color: colors[i % colors.length],
			position: basePosition + i,
			createdBy: project.createdBy,
		};
	});

	console.log(
		`Inserting ${COUNT} tasks into "${project.name}" (${project.id}) in org ${orgId}…`,
	);
	for (let i = 0; i < rows.length; i += CHUNK) {
		await db.insert(schema.task).values(rows.slice(i, i + CHUNK));
		console.log(`  inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
	}
	console.log(`\nDone. Open project "${project.name}" (${project.id}) to test.`);
}

run()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
