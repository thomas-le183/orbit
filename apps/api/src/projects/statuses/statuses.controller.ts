import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	createProjectStatusSchema,
	createTaskStatusSchema,
	deleteStatusSchema,
	updateProjectStatusSchema,
	updateTaskStatusSchema,
} from "@orbit/shared";
import type { Session } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { StatusesService } from "./statuses.service";

@UseGuards(AuthGuard)
@Controller()
export class StatusesController {
	constructor(private readonly statuses: StatusesService) {}

	@Get("task-statuses")
	listTask(@CurrentSession() session: Session) {
		return this.statuses.listTaskStatuses(this.orgId(session));
	}

	@Post("task-statuses")
	createTask(@CurrentSession() session: Session, @Body() body: unknown) {
		const input = createTaskStatusSchema.parse(body);
		return this.statuses.createTaskStatus(this.orgId(session), input);
	}

	@Patch("task-statuses/:id")
	updateTask(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const input = updateTaskStatusSchema.parse(body);
		return this.statuses.updateTaskStatus(id, this.orgId(session), input);
	}

	@Delete("task-statuses/:id")
	deleteTask(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const { reassignTo } = deleteStatusSchema.parse(body ?? {});
		return this.statuses.deleteTaskStatus(id, this.orgId(session), reassignTo);
	}

	@Get("project-statuses")
	listProject(@CurrentSession() session: Session) {
		return this.statuses.listProjectStatuses(this.orgId(session));
	}

	@Post("project-statuses")
	createProject(@CurrentSession() session: Session, @Body() body: unknown) {
		const input = createProjectStatusSchema.parse(body);
		return this.statuses.createProjectStatus(this.orgId(session), input);
	}

	@Patch("project-statuses/:id")
	updateProject(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const input = updateProjectStatusSchema.parse(body);
		return this.statuses.updateProjectStatus(id, this.orgId(session), input);
	}

	@Delete("project-statuses/:id")
	deleteProject(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const { reassignTo } = deleteStatusSchema.parse(body ?? {});
		return this.statuses.deleteProjectStatus(
			id,
			this.orgId(session),
			reassignTo,
		);
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
