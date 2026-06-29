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
	createTaskSchema,
	moveTaskSchema,
	updateTaskSchema,
} from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { TasksService } from "./tasks.service";

@UseGuards(AuthGuard)
@Controller()
export class TasksController {
	constructor(private readonly tasks: TasksService) {}

	@Get("projects/:projectId/tasks")
	list(
		@Param("projectId") projectId: string,
		@CurrentSession() session: Session,
	) {
		return this.tasks.listTasks(projectId, this.orgId(session));
	}

	@Post("projects/:projectId/tasks")
	create(
		@Param("projectId") projectId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.tasks.createTask(
			projectId,
			this.orgId(session),
			user.id,
			createTaskSchema.parse(body),
		);
	}

	@Patch("tasks/:id")
	update(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.tasks.updateTask(
			id,
			this.orgId(session),
			updateTaskSchema.parse(body),
		);
	}

	@Patch("tasks/:id/move")
	move(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.tasks.moveTask(
			id,
			this.orgId(session),
			moveTaskSchema.parse(body),
		);
	}

	@Delete("tasks/:id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.tasks.deleteTask(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
