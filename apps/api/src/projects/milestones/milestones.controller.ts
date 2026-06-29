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
import { createMilestoneSchema, updateMilestoneSchema } from "@orbit/shared";
import type { Session, User } from "../../auth/auth.constants";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { MilestonesService } from "./milestones.service";

@UseGuards(AuthGuard)
@Controller()
export class MilestonesController {
	constructor(private readonly milestones: MilestonesService) {}

	@Get("projects/:projectId/milestones")
	list(
		@Param("projectId") projectId: string,
		@CurrentSession() session: Session,
	) {
		return this.milestones.listMilestones(projectId, this.orgId(session));
	}

	@Post("projects/:projectId/milestones")
	create(
		@Param("projectId") projectId: string,
		@CurrentUser() user: User,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.milestones.createMilestone(
			projectId,
			this.orgId(session),
			user.id,
			createMilestoneSchema.parse(body),
		);
	}

	@Patch("milestones/:id")
	update(
		@Param("id") id: string,
		@CurrentSession() session: Session,
		@Body() body: unknown,
	) {
		return this.milestones.updateMilestone(
			id,
			this.orgId(session),
			updateMilestoneSchema.parse(body),
		);
	}

	@Delete("milestones/:id")
	remove(@Param("id") id: string, @CurrentSession() session: Session) {
		return this.milestones.deleteMilestone(id, this.orgId(session));
	}

	private orgId(session: Session): string {
		if (!session.activeOrganizationId) {
			throw new ForbiddenException("No active organization");
		}
		return session.activeOrganizationId;
	}
}
