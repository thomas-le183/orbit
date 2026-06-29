import {
	buildDefaultProjectStatuses,
	buildDefaultTaskStatuses,
	humanizeStatusType,
	pickDefaultStatusId,
} from "./org-defaults";

describe("org-defaults helpers", () => {
	it("humanizes status types", () => {
		expect(humanizeStatusType("in_progress")).toBe("In Progress");
		expect(humanizeStatusType("backlog")).toBe("Backlog");
	});

	it("builds the 5 default task statuses in order", () => {
		const statuses = buildDefaultTaskStatuses();
		expect(statuses.map((s) => s.type)).toEqual([
			"backlog",
			"planned",
			"in_progress",
			"done",
			"canceled",
		]);
		expect(statuses[2].name).toBe("In Progress");
	});

	it("builds the 5 default project statuses in order", () => {
		const statuses = buildDefaultProjectStatuses();
		expect(statuses.map((s) => s.type)).toEqual([
			"draft",
			"planning",
			"execution",
			"monitoring",
			"completed",
		]);
		expect(statuses[1].name).toBe("Planning");
	});

	it("picks the preferred-type status with the lowest position", () => {
		const rows = [
			{ id: "a", type: "planned", position: 0 },
			{ id: "b", type: "backlog", position: 1 },
			{ id: "c", type: "backlog", position: 0 },
		];
		expect(pickDefaultStatusId(rows, "backlog")).toBe("c");
	});

	it("falls back to the lowest-position status when preferred type is absent", () => {
		const rows = [
			{ id: "a", type: "planned", position: 2 },
			{ id: "b", type: "done", position: 1 },
		];
		expect(pickDefaultStatusId(rows, "backlog")).toBe("b");
	});
});
