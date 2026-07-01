import { BadRequestException, ConflictException } from "@nestjs/common";
import { DependenciesService } from "./dependencies.service";

type Row = { id: string; projectId: string };

function createService(
	opts: { tasksInProject?: string[]; existingEdge?: boolean } = {},
) {
	const tasksInProject = new Set(opts.tasksInProject ?? ["t1", "t2"]);
	const insertValues = jest.fn().mockResolvedValue(undefined);
	const db = {
		query: {
			task: {
				findMany: jest.fn(async () =>
					[...tasksInProject].map((id) => ({ id })),
				),
			},
			taskDependency: {
				findFirst: jest.fn(async () =>
					opts.existingEdge ? { id: "dep-existing" } : undefined,
				),
				findMany: jest.fn(
					async () => [{ id: "dep1", projectId: "p1" }] as Row[],
				),
			},
		},
		insert: jest.fn(() => ({ values: insertValues })),
		delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
	};
	const projects = {
		assertProjectInOrg: jest.fn().mockResolvedValue(undefined),
	};
	const service = new DependenciesService(db as never, projects as never);
	return { service, db, projects, insertValues };
}

describe("DependenciesService.createDependency", () => {
	it("creates a dependency for two tasks in the project", async () => {
		const { service, insertValues, projects } = createService();
		await service.createDependency("p1", "org1", "user1", {
			predecessorId: "t1",
			successorId: "t2",
			type: "FS",
		});
		expect(projects.assertProjectInOrg).toHaveBeenCalledWith("p1", "org1");
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "p1",
				predecessorId: "t1",
				successorId: "t2",
				type: "FS",
				createdBy: "user1",
			}),
		);
	});

	it("rejects a self-link", async () => {
		const { service } = createService();
		await expect(
			service.createDependency("p1", "org1", "user1", {
				predecessorId: "t1",
				successorId: "t1",
				type: "FS",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("rejects a task that is not in the project", async () => {
		const { service } = createService({ tasksInProject: ["t1"] });
		await expect(
			service.createDependency("p1", "org1", "user1", {
				predecessorId: "t1",
				successorId: "t2",
				type: "FS",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("rejects a duplicate edge", async () => {
		const { service } = createService({ existingEdge: true });
		await expect(
			service.createDependency("p1", "org1", "user1", {
				predecessorId: "t1",
				successorId: "t2",
				type: "FS",
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});
});
