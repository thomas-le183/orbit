import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateMilestoneInput, UpdateMilestoneInput } from "@orbit/shared";
import { asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class MilestonesService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly projects: ProjectsService,
	) {}

	async listMilestones(projectId: string, orgId: string) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		return this.db.query.milestone.findMany({
			where: eq(schema.milestone.projectId, projectId),
			orderBy: [asc(schema.milestone.date), asc(schema.milestone.position)],
		});
	}

	async createMilestone(
		projectId: string,
		orgId: string,
		userId: string,
		input: CreateMilestoneInput,
	) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		const id = randomUUID();
		await this.db.insert(schema.milestone).values({
			id,
			projectId,
			name: input.name,
			date: input.date,
			description: input.description,
			color: input.color,
			position: input.position ?? 0,
			createdBy: userId,
		});
		return this.getMilestone(id, orgId);
	}

	async updateMilestone(
		id: string,
		orgId: string,
		input: UpdateMilestoneInput,
	) {
		await this.getMilestone(id, orgId);
		const { completedAt, ...rest } = input;
		await this.db
			.update(schema.milestone)
			.set({
				...rest,
				...(completedAt !== undefined
					? { completedAt: completedAt ? new Date(completedAt) : null }
					: {}),
			})
			.where(eq(schema.milestone.id, id));
		return this.getMilestone(id, orgId);
	}

	async deleteMilestone(id: string, orgId: string) {
		await this.getMilestone(id, orgId);
		await this.db.delete(schema.milestone).where(eq(schema.milestone.id, id));
		return { deleted: true };
	}

	private async getMilestone(id: string, orgId: string) {
		const row = await this.db.query.milestone.findFirst({
			where: eq(schema.milestone.id, id),
			with: { project: { columns: { organizationId: true } } },
		});
		if (!row || row.project.organizationId !== orgId) {
			throw new NotFoundException("Milestone not found");
		}
		return row;
	}
}
