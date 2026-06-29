import { randomUUID } from "node:crypto";
import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	CreateProjectStatusInput,
	CreateTaskStatusInput,
	UpdateProjectStatusInput,
	UpdateTaskStatusInput,
} from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ensureOrgDefaults } from "../org-defaults";

@Injectable()
export class StatusesService {
	constructor(@Inject(DB) private readonly db: Db) {}

	// ── Task statuses ──────────────────────────────────────────────

	async listTaskStatuses(orgId: string) {
		await ensureOrgDefaults(this.db, orgId);
		return this.db.query.taskStatus.findMany({
			where: eq(schema.taskStatus.organizationId, orgId),
			orderBy: [asc(schema.taskStatus.position)],
		});
	}

	async createTaskStatus(orgId: string, input: CreateTaskStatusInput) {
		const id = randomUUID();
		await this.db.insert(schema.taskStatus).values({
			id,
			organizationId: orgId,
			type: input.type,
			name: input.name,
			color: input.color,
			position: input.position ?? 0,
		});
		return this.getTaskStatus(id, orgId);
	}

	async updateTaskStatus(
		id: string,
		orgId: string,
		input: UpdateTaskStatusInput,
	) {
		await this.getTaskStatus(id, orgId);
		await this.db
			.update(schema.taskStatus)
			.set(input)
			.where(eq(schema.taskStatus.id, id));
		return this.getTaskStatus(id, orgId);
	}

	async deleteTaskStatus(id: string, orgId: string, reassignTo?: string) {
		await this.getTaskStatus(id, orgId);
		await this.db.transaction(async (tx) => {
			const inUse = await tx.query.task.findFirst({
				where: eq(schema.task.statusId, id),
			});
			if (inUse) {
				if (!reassignTo) {
					throw new ConflictException(
						"Status is in use; provide reassignTo to migrate tasks first",
					);
				}
				const target = await tx.query.taskStatus.findFirst({
					where: and(
						eq(schema.taskStatus.id, reassignTo),
						eq(schema.taskStatus.organizationId, orgId),
					),
				});
				if (!target) throw new NotFoundException("reassignTo status not found");
				await tx
					.update(schema.task)
					.set({ statusId: reassignTo })
					.where(eq(schema.task.statusId, id));
			}
			await tx.delete(schema.taskStatus).where(eq(schema.taskStatus.id, id));
		});
		return { deleted: true };
	}

	private async getTaskStatus(id: string, orgId: string) {
		const row = await this.db.query.taskStatus.findFirst({
			where: and(
				eq(schema.taskStatus.id, id),
				eq(schema.taskStatus.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Task status not found");
		return row;
	}

	// ── Project statuses ───────────────────────────────────────────

	async listProjectStatuses(orgId: string) {
		await ensureOrgDefaults(this.db, orgId);
		return this.db.query.projectStatus.findMany({
			where: eq(schema.projectStatus.organizationId, orgId),
			orderBy: [asc(schema.projectStatus.position)],
		});
	}

	async createProjectStatus(orgId: string, input: CreateProjectStatusInput) {
		const id = randomUUID();
		await this.db.insert(schema.projectStatus).values({
			id,
			organizationId: orgId,
			type: input.type,
			name: input.name,
			color: input.color,
			position: input.position ?? 0,
		});
		return this.getProjectStatus(id, orgId);
	}

	async updateProjectStatus(
		id: string,
		orgId: string,
		input: UpdateProjectStatusInput,
	) {
		await this.getProjectStatus(id, orgId);
		await this.db
			.update(schema.projectStatus)
			.set(input)
			.where(eq(schema.projectStatus.id, id));
		return this.getProjectStatus(id, orgId);
	}

	async deleteProjectStatus(id: string, orgId: string, reassignTo?: string) {
		await this.getProjectStatus(id, orgId);
		await this.db.transaction(async (tx) => {
			const inUse = await tx.query.project.findFirst({
				where: eq(schema.project.statusId, id),
			});
			if (inUse) {
				if (!reassignTo) {
					throw new ConflictException(
						"Status is in use; provide reassignTo to migrate projects first",
					);
				}
				const target = await tx.query.projectStatus.findFirst({
					where: and(
						eq(schema.projectStatus.id, reassignTo),
						eq(schema.projectStatus.organizationId, orgId),
					),
				});
				if (!target) throw new NotFoundException("reassignTo status not found");
				await tx
					.update(schema.project)
					.set({ statusId: reassignTo })
					.where(eq(schema.project.statusId, id));
			}
			await tx
				.delete(schema.projectStatus)
				.where(eq(schema.projectStatus.id, id));
		});
		return { deleted: true };
	}

	private async getProjectStatus(id: string, orgId: string) {
		const row = await this.db.query.projectStatus.findFirst({
			where: and(
				eq(schema.projectStatus.id, id),
				eq(schema.projectStatus.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Project status not found");
		return row;
	}
}
