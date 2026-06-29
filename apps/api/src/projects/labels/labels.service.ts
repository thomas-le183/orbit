import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateLabelInput, UpdateLabelInput } from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";

@Injectable()
export class LabelsService {
	constructor(@Inject(DB) private readonly db: Db) {}

	listTaskLabels(orgId: string) {
		return this.db.query.taskLabel.findMany({
			where: eq(schema.taskLabel.organizationId, orgId),
			orderBy: [asc(schema.taskLabel.name)],
		});
	}

	async createTaskLabel(orgId: string, input: CreateLabelInput) {
		const id = randomUUID();
		await this.db.insert(schema.taskLabel).values({
			id,
			organizationId: orgId,
			name: input.name,
			color: input.color,
		});
		return this.getTaskLabel(id, orgId);
	}

	async updateTaskLabel(id: string, orgId: string, input: UpdateLabelInput) {
		await this.getTaskLabel(id, orgId);
		await this.db
			.update(schema.taskLabel)
			.set(input)
			.where(eq(schema.taskLabel.id, id));
		return this.getTaskLabel(id, orgId);
	}

	async deleteTaskLabel(id: string, orgId: string) {
		await this.getTaskLabel(id, orgId);
		await this.db.delete(schema.taskLabel).where(eq(schema.taskLabel.id, id));
		return { deleted: true };
	}

	private async getTaskLabel(id: string, orgId: string) {
		const row = await this.db.query.taskLabel.findFirst({
			where: and(
				eq(schema.taskLabel.id, id),
				eq(schema.taskLabel.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Task label not found");
		return row;
	}

	listProjectLabels(orgId: string) {
		return this.db.query.projectLabel.findMany({
			where: eq(schema.projectLabel.organizationId, orgId),
			orderBy: [asc(schema.projectLabel.name)],
		});
	}

	async createProjectLabel(orgId: string, input: CreateLabelInput) {
		const id = randomUUID();
		await this.db.insert(schema.projectLabel).values({
			id,
			organizationId: orgId,
			name: input.name,
			color: input.color,
		});
		return this.getProjectLabel(id, orgId);
	}

	async updateProjectLabel(id: string, orgId: string, input: UpdateLabelInput) {
		await this.getProjectLabel(id, orgId);
		await this.db
			.update(schema.projectLabel)
			.set(input)
			.where(eq(schema.projectLabel.id, id));
		return this.getProjectLabel(id, orgId);
	}

	async deleteProjectLabel(id: string, orgId: string) {
		await this.getProjectLabel(id, orgId);
		await this.db
			.delete(schema.projectLabel)
			.where(eq(schema.projectLabel.id, id));
		return { deleted: true };
	}

	private async getProjectLabel(id: string, orgId: string) {
		const row = await this.db.query.projectLabel.findFirst({
			where: and(
				eq(schema.projectLabel.id, id),
				eq(schema.projectLabel.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Project label not found");
		return row;
	}
}
