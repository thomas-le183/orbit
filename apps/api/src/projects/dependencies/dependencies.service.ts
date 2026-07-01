import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
} from "@nestjs/common";
import type { CreateDependencyInput } from "@orbit/shared";
import { and, eq, inArray } from "drizzle-orm";
import { DB, type Db } from "../../db/db.module";
import * as schema from "../../db/schema";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class DependenciesService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly projects: ProjectsService,
	) {}

	async listDependencies(projectId: string, orgId: string) {
		await this.projects.assertProjectInOrg(projectId, orgId);
		return this.db.query.taskDependency.findMany({
			where: eq(schema.taskDependency.projectId, projectId),
		});
	}

	async createDependency(
		projectId: string,
		orgId: string,
		userId: string,
		input: CreateDependencyInput,
	) {
		await this.projects.assertProjectInOrg(projectId, orgId);

		if (input.predecessorId === input.successorId) {
			throw new BadRequestException("A task cannot depend on itself");
		}

		const ids = [input.predecessorId, input.successorId];
		const found = await this.db.query.task.findMany({
			columns: { id: true },
			where: and(
				inArray(schema.task.id, ids),
				eq(schema.task.projectId, projectId),
			),
		});
		if (found.length !== 2) {
			throw new BadRequestException(
				"Both tasks must belong to this project",
			);
		}

		const existing = await this.db.query.taskDependency.findFirst({
			columns: { id: true },
			where: and(
				eq(schema.taskDependency.predecessorId, input.predecessorId),
				eq(schema.taskDependency.successorId, input.successorId),
				eq(schema.taskDependency.type, input.type),
			),
		});
		if (existing) {
			throw new ConflictException("This dependency already exists");
		}

		const id = randomUUID();
		await this.db.insert(schema.taskDependency).values({
			id,
			projectId,
			predecessorId: input.predecessorId,
			successorId: input.successorId,
			type: input.type,
			createdBy: userId,
		});
		return { id, projectId, ...input };
	}

	async deleteDependency(id: string, orgId: string) {
		const dep = await this.db.query.taskDependency.findFirst({
			where: eq(schema.taskDependency.id, id),
			with: { project: { columns: { organizationId: true } } },
		});
		if (!dep || dep.project.organizationId !== orgId) {
			throw new BadRequestException("Dependency not found");
		}
		await this.db
			.delete(schema.taskDependency)
			.where(eq(schema.taskDependency.id, id));
		return { id };
	}
}
