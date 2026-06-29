import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateProjectInput, UpdateProjectInput } from "@orbit/shared";
import { and, asc, eq } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ensureOrgDefaults, pickDefaultStatusId } from "../org-defaults";

@Injectable()
export class ProjectsService {
	constructor(@Inject(DB) private readonly db: Db) {}

	listProjects(orgId: string) {
		return this.db.query.project.findMany({
			where: eq(schema.project.organizationId, orgId),
			orderBy: [asc(schema.project.createdAt)],
		});
	}

	async getProject(id: string, orgId: string) {
		const row = await this.db.query.project.findFirst({
			where: and(
				eq(schema.project.id, id),
				eq(schema.project.organizationId, orgId),
			),
			with: {
				status: true,
				teams: true,
				labelLinks: true,
			},
		});
		if (!row) throw new NotFoundException("Project not found");
		return row;
	}

	// Used by Tasks & Milestones services to verify project ownership.
	async assertProjectInOrg(projectId: string, orgId: string) {
		const row = await this.db.query.project.findFirst({
			columns: { id: true },
			where: and(
				eq(schema.project.id, projectId),
				eq(schema.project.organizationId, orgId),
			),
		});
		if (!row) throw new NotFoundException("Project not found");
	}

	async createProject(
		orgId: string,
		userId: string,
		input: CreateProjectInput,
	) {
		await ensureOrgDefaults(this.db, orgId);
		const statusId =
			input.statusId ?? (await this.defaultProjectStatusId(orgId));
		const id = randomUUID();
		await this.db.transaction(async (tx) => {
			await tx.insert(schema.project).values({
				id,
				organizationId: orgId,
				name: input.name,
				description: input.description,
				statusId,
				color: input.color,
				startDate: input.startDate,
				endDate: input.endDate,
				createdBy: userId,
			});
			if (input.teamIds?.length) {
				await tx
					.insert(schema.projectTeam)
					.values(input.teamIds.map((teamId) => ({ projectId: id, teamId })));
			}
			if (input.labelIds?.length) {
				await tx.insert(schema.projectLabelLink).values(
					input.labelIds.map((projectLabelId) => ({
						projectId: id,
						projectLabelId,
					})),
				);
			}
		});
		return this.getProject(id, orgId);
	}

	async updateProject(id: string, orgId: string, input: UpdateProjectInput) {
		await this.assertProjectInOrg(id, orgId);
		await this.db.transaction(async (tx) => {
			const { teamIds, labelIds, ...fields } = input;
			if (Object.keys(fields).length > 0) {
				await tx
					.update(schema.project)
					.set(fields)
					.where(eq(schema.project.id, id));
			}
			if (teamIds) {
				await tx
					.delete(schema.projectTeam)
					.where(eq(schema.projectTeam.projectId, id));
				if (teamIds.length) {
					await tx
						.insert(schema.projectTeam)
						.values(teamIds.map((teamId) => ({ projectId: id, teamId })));
				}
			}
			if (labelIds) {
				await tx
					.delete(schema.projectLabelLink)
					.where(eq(schema.projectLabelLink.projectId, id));
				if (labelIds.length) {
					await tx.insert(schema.projectLabelLink).values(
						labelIds.map((projectLabelId) => ({
							projectId: id,
							projectLabelId,
						})),
					);
				}
			}
		});
		return this.getProject(id, orgId);
	}

	async deleteProject(id: string, orgId: string) {
		await this.assertProjectInOrg(id, orgId);
		await this.db.delete(schema.project).where(eq(schema.project.id, id));
		return { deleted: true };
	}

	private async defaultProjectStatusId(orgId: string): Promise<string> {
		const statuses = await this.db.query.projectStatus.findMany({
			where: eq(schema.projectStatus.organizationId, orgId),
		});
		return pickDefaultStatusId(statuses, "draft");
	}
}
