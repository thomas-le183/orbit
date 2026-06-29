import { randomUUID } from "node:crypto";
import {
	PROJECT_STATUS_TYPES,
	type ProjectStatusType,
	TASK_STATUS_TYPES,
	type TaskStatusType,
} from "@orbit/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/db.module";
import * as schema from "../db/schema";

export function humanizeStatusType(type: string): string {
	return type
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function buildDefaultTaskStatuses(): {
	type: TaskStatusType;
	name: string;
}[] {
	return TASK_STATUS_TYPES.map((type) => ({
		type,
		name: humanizeStatusType(type),
	}));
}

export function buildDefaultProjectStatuses(): {
	type: ProjectStatusType;
	name: string;
}[] {
	return PROJECT_STATUS_TYPES.map((type) => ({
		type,
		name: humanizeStatusType(type),
	}));
}

export function pickDefaultStatusId(
	statuses: { id: string; type: string; position: number }[],
	preferredType: string,
): string {
	const sorted = [...statuses].sort((a, b) => a.position - b.position);
	const preferred = sorted.find((s) => s.type === preferredType);
	const chosen = preferred ?? sorted[0];
	if (!chosen) {
		throw new Error("No statuses available to pick a default from");
	}
	return chosen.id;
}

// Idempotent: seeds default statuses only if the org has none yet.
export async function ensureOrgDefaults(db: Db, orgId: string): Promise<void> {
	const existingTask = await db.query.taskStatus.findFirst({
		where: eq(schema.taskStatus.organizationId, orgId),
	});
	if (!existingTask) {
		await db.insert(schema.taskStatus).values(
			buildDefaultTaskStatuses().map((s, index) => ({
				id: randomUUID(),
				organizationId: orgId,
				type: s.type,
				name: s.name,
				position: index,
			})),
		);
	}

	const existingProject = await db.query.projectStatus.findFirst({
		where: eq(schema.projectStatus.organizationId, orgId),
	});
	if (!existingProject) {
		await db.insert(schema.projectStatus).values(
			buildDefaultProjectStatuses().map((s, index) => ({
				id: randomUUID(),
				organizationId: orgId,
				type: s.type,
				name: s.name,
				position: index,
			})),
		);
	}
}
