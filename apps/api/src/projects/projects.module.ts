import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DependenciesController } from "./dependencies/dependencies.controller";
import { DependenciesService } from "./dependencies/dependencies.service";
import { LabelsController } from "./labels/labels.controller";
import { LabelsService } from "./labels/labels.service";
import { MilestonesController } from "./milestones/milestones.controller";
import { MilestonesService } from "./milestones/milestones.service";
import { ProjectsController } from "./projects/projects.controller";
import { ProjectsService } from "./projects/projects.service";
import { StatusesController } from "./statuses/statuses.controller";
import { StatusesService } from "./statuses/statuses.service";
import { TasksController } from "./tasks/tasks.controller";
import { TasksService } from "./tasks/tasks.service";

@Module({
	imports: [AuthModule],
	controllers: [
		ProjectsController,
		TasksController,
		MilestonesController,
		StatusesController,
		LabelsController,
		DependenciesController,
	],
	providers: [
		ProjectsService,
		TasksService,
		MilestonesService,
		StatusesService,
		LabelsService,
		DependenciesService,
	],
})
export class ProjectsModule {}
