import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	Put,
	UseGuards,
} from "@nestjs/common";
import {
	createProjectSchema,
	setProjectTeamsSchema,
	updateProjectSchema,
} from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ProjectsService } from "./projects.service";

@UseGuards(AuthGuard)
@Controller("projects")
export class ProjectsController {
	constructor(private readonly projects: ProjectsService) {}

	@Get()
	list(@CurrentSession() session: Session) {
		return this.projects.listProjects(this.orgId(session));
	}

	@Get(":id")
	get(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.projects.getProject(id, this.orgId(session));
	}

	@Post()
	create(
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.projects.createProject(
			this.orgId(session),
			user.id,
			createProjectSchema.parse(body),
		);
	}

	@Patch(":id")
	update(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.projects.updateProject(
			id,
			this.orgId(session),
			updateProjectSchema.parse(body),
		);
	}

	@Delete(":id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.projects.deleteProject(id, this.orgId(session));
	}

	@Put(":id/teams")
	setTeams(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		const { teamIds } = setProjectTeamsSchema.parse(body);
		return this.projects.updateProject(id, this.orgId(session), { teamIds });
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
