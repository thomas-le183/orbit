import { randomUUID } from "node:crypto";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	CreateTaskInput,
	MoveTaskInput,
	UpdateTaskInput,
} from "@orbit/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ensureOrgDefaults, pickDefaultStatusId } from "../org-defaults";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class TasksService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly projects: ProjectsService,
	) {}

	async listTasks(projectId: string, orgId: string) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		return this.db.query.task.findMany({
			where: eq(schema.task.projectId, projectId),
			orderBy: [asc(schema.task.position)],
			with: { labelLinks: true },
		});
	}

	async createTask(
		projectId: string,
		orgId: string,
		userId: string,
		input: CreateTaskInput,
	) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		await ensureOrgDefaults(this.db, orgId);
		const statusId = input.statusId ?? (await this.defaultTaskStatusId(orgId));
		await this.assertTaskRefsInOrg(orgId, projectId, {
			statusId: input.statusId,
			assigneeId: input.assigneeId,
			labelIds: input.labelIds,
			parentId: input.parentId,
		});
		const id = randomUUID();
		await this.db.transaction(async (tx) => {
			await tx.insert(schema.task).values({
				id,
				projectId,
				parentId: input.parentId,
				name: input.name,
				description: input.description,
				statusId,
				priority: input.priority ?? "none",
				progress: input.progress ?? 0,
				startDate: input.startDate,
				endDate: input.endDate,
				color: input.color,
				assigneeId: input.assigneeId,
				position: input.position ?? 0,
				createdBy: userId,
			});
			if (input.labelIds?.length) {
				await tx
					.insert(schema.taskLabelLink)
					.values(
						input.labelIds.map((taskLabelId) => ({ taskId: id, taskLabelId })),
					);
			}
		});
		return this.getTask(id, orgId);
	}

	async updateTask(id: string, orgId: string, input: UpdateTaskInput) {
		const existing = await this.getTask(id, orgId);
		await this.assertTaskRefsInOrg(orgId, existing.projectId, {
			statusId: input.statusId,
			assigneeId: input.assigneeId,
			labelIds: input.labelIds,
			parentId: input.parentId,
		});
		await this.db.transaction(async (tx) => {
			const { labelIds, ...fields } = input;
			if (Object.keys(fields).length > 0) {
				await tx.update(schema.task).set(fields).where(eq(schema.task.id, id));
			}
			if (labelIds) {
				await tx
					.delete(schema.taskLabelLink)
					.where(eq(schema.taskLabelLink.taskId, id));
				if (labelIds.length) {
					await tx
						.insert(schema.taskLabelLink)
						.values(
							labelIds.map((taskLabelId) => ({ taskId: id, taskLabelId })),
						);
				}
			}
		});
		return this.getTask(id, orgId);
	}

	async moveTask(id: string, orgId: string, input: MoveTaskInput) {
		const existing = await this.getTask(id, orgId);
		await this.assertTaskRefsInOrg(orgId, existing.projectId, {
			parentId: input.parentId,
		});
		await this.db
			.update(schema.task)
			.set({ parentId: input.parentId ?? null, position: input.position })
			.where(eq(schema.task.id, id));
		return this.getTask(id, orgId);
	}

	async deleteTask(id: string, orgId: string) {
		await this.getTask(id, orgId);
		await this.db.delete(schema.task).where(eq(schema.task.id, id));
		return { deleted: true };
	}

	// A task belongs to the org iff its project does. Join through project.
	private async getTask(id: string, orgId: string) {
		const row = await this.db.query.task.findFirst({
			where: eq(schema.task.id, id),
			with: {
				project: { columns: { organizationId: true } },
				labelLinks: true,
			},
		});
		if (!row || row.project.organizationId !== orgId) {
			throw new NotFoundException("Task not found");
		}
		return row;
	}

	private async defaultTaskStatusId(orgId: string): Promise<string> {
		const statuses = await this.db.query.taskStatus.findMany({
			where: eq(schema.taskStatus.organizationId, orgId),
		});
		return pickDefaultStatusId(statuses, "backlog");
	}

	// Reject references that don't belong to the org/project — prevents cross-org IDOR.
	private async assertTaskRefsInOrg(
		orgId: string,
		projectId: string,
		refs: {
			statusId?: string;
			assigneeId?: string;
			labelIds?: string[];
			parentId?: string | null;
		},
	): Promise<void> {
		if (refs.statusId) {
			const found = await this.db.query.taskStatus.findFirst({
				columns: { id: true },
				where: and(
					eq(schema.taskStatus.id, refs.statusId),
					eq(schema.taskStatus.organizationId, orgId),
				),
			});
			if (!found) {
				throw new ForbiddenException("statusId is not in this organization");
			}
		}
		if (refs.assigneeId) {
			const member = await this.db.query.member.findFirst({
				columns: { id: true },
				where: and(
					eq(schema.member.userId, refs.assigneeId),
					eq(schema.member.organizationId, orgId),
				),
			});
			if (!member) {
				throw new ForbiddenException(
					"assignee is not a member of this organization",
				);
			}
		}
		if (refs.labelIds?.length) {
			const rows = await this.db.query.taskLabel.findMany({
				columns: { id: true },
				where: and(
					inArray(schema.taskLabel.id, refs.labelIds),
					eq(schema.taskLabel.organizationId, orgId),
				),
			});
			if (rows.length !== new Set(refs.labelIds).size) {
				throw new ForbiddenException(
					"One or more labelIds are not in this organization",
				);
			}
		}
		if (refs.parentId) {
			const parent = await this.db.query.task.findFirst({
				columns: { id: true },
				where: and(
					eq(schema.task.id, refs.parentId),
					eq(schema.task.projectId, projectId),
				),
			});
			if (!parent) {
				throw new ForbiddenException("parentId is not a task in this project");
			}
		}
	}
}
