import { TasksService } from "./tasks.service";

jest.mock("../org-defaults", () => ({
	ensureOrgDefaults: jest.fn().mockResolvedValue(undefined),
	pickDefaultStatusId: jest.fn(() => "s1"),
}));

function createServiceForCreate() {
	const insertValues = jest.fn().mockResolvedValue(undefined);
	const tx = { insert: jest.fn(() => ({ values: insertValues })) };
	const db = {
		transaction: jest.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
		query: {
			taskStatus: { findFirst: jest.fn(async () => ({ id: "s1" })) },
			task: {
				findFirst: jest.fn(async () => ({
					id: "new",
					projectId: "p1",
					project: { organizationId: "org1" },
					labelLinks: [],
				})),
			},
		},
	};
	const projects = { assertProjectInOrg: jest.fn().mockResolvedValue(undefined) };
	const service = new TasksService(db as never, projects as never);
	return { service, insertValues };
}

function createServiceForUpdate() {
	const setWhere = jest.fn().mockResolvedValue(undefined);
	const setFn = jest.fn(() => ({ where: setWhere }));
	const tx = { update: jest.fn(() => ({ set: setFn })) };
	const db = {
		transaction: jest.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx)),
		query: {
			task: {
				findFirst: jest.fn(async () => ({
					id: "t1",
					projectId: "p1",
					project: { organizationId: "org1" },
					labelLinks: [],
				})),
			},
		},
	};
	const projects = { assertProjectInOrg: jest.fn().mockResolvedValue(undefined) };
	const service = new TasksService(db as never, projects as never);
	return { service, setFn };
}

describe("TasksService estimatedTime", () => {
	it("createTask writes estimatedTime to the insert", async () => {
		const { service, insertValues } = createServiceForCreate();
		await service.createTask("p1", "org1", "user1", {
			name: "Alpha",
			statusId: "s1",
			estimatedTime: 120,
		});
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ estimatedTime: 120 }),
		);
	});

	it("updateTask sets estimatedTime", async () => {
		const { service, setFn } = createServiceForUpdate();
		await service.updateTask("t1", "org1", { estimatedTime: 240 });
		expect(setFn).toHaveBeenCalledWith(
			expect.objectContaining({ estimatedTime: 240 }),
		);
	});
});
