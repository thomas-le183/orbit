import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import { createDependencySchema } from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { DependenciesService } from "./dependencies.service";

@UseGuards(AuthGuard)
@Controller()
export class DependenciesController {
	constructor(private readonly dependencies: DependenciesService) {}

	@Get("projects/:projectId/dependencies")
	list(
		@Param("projectId") projectId: string,
		@CurrentSession() session: Session,
	) {
		return this.dependencies.listDependencies(projectId, this.orgId(session));
	}

	@Post("projects/:projectId/dependencies")
	create(
		@Param("projectId") projectId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.dependencies.createDependency(
			projectId,
			this.orgId(session),
			user.id,
			createDependencySchema.parse(body),
		);
	}

	@Delete("dependencies/:id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.dependencies.deleteDependency(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
