import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	date,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { organization, team, user } from "./auth";

// ---------- Taxonomy (org-wide) ----------

export const taskStatus = pgTable("task_status", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	name: text("name").notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectStatus = pgTable("project_status", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	name: text("name").notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskLabel = pgTable("task_label", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	color: text("color"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectLabel = pgTable("project_label", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	color: text("color"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Project ----------

export const project = pgTable("project", {
	id: text("id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	statusId: text("status_id")
		.notNull()
		.references(() => projectStatus.id, { onDelete: "restrict" }),
	color: text("color"),
	startDate: date("start_date", { mode: "string" }),
	endDate: date("end_date", { mode: "string" }),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	archivedAt: timestamp("archived_at"),
});

export const projectTeam = pgTable(
	"project_team",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		teamId: uuid("team_id")
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.projectId, t.teamId] })],
);

export const projectLabelLink = pgTable(
	"project_label_link",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		projectLabelId: text("project_label_id")
			.notNull()
			.references(() => projectLabel.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.projectId, t.projectLabelId] })],
);

// ---------- Task ----------

export const task = pgTable("task", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	parentId: text("parent_id").references((): AnyPgColumn => task.id, {
		onDelete: "cascade",
	}),
	name: text("name").notNull(),
	description: text("description"),
	statusId: text("status_id")
		.notNull()
		.references(() => taskStatus.id, { onDelete: "restrict" }),
	priority: text("priority").notNull().default("none"),
	progress: integer("progress").notNull().default(0),
	startDate: date("start_date", { mode: "string" }),
	endDate: date("end_date", { mode: "string" }),
	color: text("color"),
	assigneeId: uuid("assignee_id").references(() => user.id, {
		onDelete: "set null",
	}),
	position: integer("position").notNull().default(0),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const taskLabelLink = pgTable(
	"task_label_link",
	{
		taskId: text("task_id")
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		taskLabelId: text("task_label_id")
			.notNull()
			.references(() => taskLabel.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.taskId, t.taskLabelId] })],
);

export const taskDependency = pgTable(
	"task_dependency",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		predecessorId: text("predecessor_id")
			.notNull()
			.references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
		successorId: text("successor_id")
			.notNull()
			.references((): AnyPgColumn => task.id, { onDelete: "cascade" }),
		// Two-letter anchor code: FS | SS | FF | SF (predecessor anchor + successor anchor).
		type: text("type").notNull().default("FS"),
		createdBy: uuid("created_by")
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		// One dependency per ordered pair, regardless of type. The reverse
		// direction is blocked in the service (a plain unique can't span both).
		unique("task_dependency_edge_unique").on(t.predecessorId, t.successorId),
	],
);

export const taskDependencyRelations = relations(taskDependency, ({ one }) => ({
	project: one(project, {
		fields: [taskDependency.projectId],
		references: [project.id],
	}),
	predecessor: one(task, {
		fields: [taskDependency.predecessorId],
		references: [task.id],
		relationName: "predecessor",
	}),
	successor: one(task, {
		fields: [taskDependency.successorId],
		references: [task.id],
		relationName: "successor",
	}),
}));

// ---------- Milestone ----------

export const milestone = pgTable("milestone", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	date: date("date", { mode: "string" }).notNull(),
	color: text("color"),
	position: integer("position").notNull().default(0),
	completedAt: timestamp("completed_at"),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

// ---------- Relations ----------

export const projectRelations = relations(project, ({ one, many }) => ({
	organization: one(organization, {
		fields: [project.organizationId],
		references: [organization.id],
	}),
	status: one(projectStatus, {
		fields: [project.statusId],
		references: [projectStatus.id],
	}),
	tasks: many(task),
	milestones: many(milestone),
	teams: many(projectTeam),
	labelLinks: many(projectLabelLink),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
	project: one(project, {
		fields: [task.projectId],
		references: [project.id],
	}),
	status: one(taskStatus, {
		fields: [task.statusId],
		references: [taskStatus.id],
	}),
	parent: one(task, {
		fields: [task.parentId],
		references: [task.id],
		relationName: "subtasks",
	}),
	children: many(task, { relationName: "subtasks" }),
	assignee: one(user, {
		fields: [task.assigneeId],
		references: [user.id],
	}),
	labelLinks: many(taskLabelLink),
}));

export const milestoneRelations = relations(milestone, ({ one }) => ({
	project: one(project, {
		fields: [milestone.projectId],
		references: [project.id],
	}),
}));

export const taskStatusRelations = relations(taskStatus, ({ many }) => ({
	tasks: many(task),
}));

export const projectStatusRelations = relations(projectStatus, ({ many }) => ({
	projects: many(project),
}));

export const taskLabelRelations = relations(taskLabel, ({ many }) => ({
	links: many(taskLabelLink),
}));

export const projectLabelRelations = relations(projectLabel, ({ many }) => ({
	links: many(projectLabelLink),
}));

export const projectTeamRelations = relations(projectTeam, ({ one }) => ({
	project: one(project, {
		fields: [projectTeam.projectId],
		references: [project.id],
	}),
	team: one(team, {
		fields: [projectTeam.teamId],
		references: [team.id],
	}),
}));

export const taskLabelLinkRelations = relations(taskLabelLink, ({ one }) => ({
	task: one(task, {
		fields: [taskLabelLink.taskId],
		references: [task.id],
	}),
	label: one(taskLabel, {
		fields: [taskLabelLink.taskLabelId],
		references: [taskLabel.id],
	}),
}));

export const projectLabelLinkRelations = relations(
	projectLabelLink,
	({ one }) => ({
		project: one(project, {
			fields: [projectLabelLink.projectId],
			references: [project.id],
		}),
		label: one(projectLabel, {
			fields: [projectLabelLink.projectLabelId],
			references: [projectLabel.id],
		}),
	}),
);
