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
import { createLabelSchema, updateLabelSchema } from "@orbit/shared";
import type { Session } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { LabelsService } from "./labels.service";

@UseGuards(AuthGuard)
@Controller()
export class LabelsController {
	constructor(private readonly labels: LabelsService) {}

	@Get("task-labels")
	listTask(@CurrentSession() session: Session) {
		return this.labels.listTaskLabels(this.orgId(session));
	}

	@Post("task-labels")
	createTask(@CurrentSession() session: Session, @Body() body: unknown) {
		return this.labels.createTaskLabel(
			this.orgId(session),
			createLabelSchema.parse(body),
		);
	}

	@Patch("task-labels/:id")
	updateTask(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.labels.updateTaskLabel(
			id,
			this.orgId(session),
			updateLabelSchema.parse(body),
		);
	}

	@Delete("task-labels/:id")
	deleteTask(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.labels.deleteTaskLabel(id, this.orgId(session));
	}

	@Get("project-labels")
	listProject(@CurrentSession() session: Session) {
		return this.labels.listProjectLabels(this.orgId(session));
	}

	@Post("project-labels")
	createProject(@CurrentSession() session: Session, @Body() body: unknown) {
		return this.labels.createProjectLabel(
			this.orgId(session),
			createLabelSchema.parse(body),
		);
	}

	@Patch("project-labels/:id")
	updateProject(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.labels.updateProjectLabel(
			id,
			this.orgId(session),
			updateLabelSchema.parse(body),
		);
	}

	@Delete("project-labels/:id")
	deleteProject(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.labels.deleteProjectLabel(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
