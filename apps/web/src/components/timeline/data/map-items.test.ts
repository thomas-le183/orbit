import { describe, expect, it } from "vitest";
import type { TaskAssignee } from "@/data/timeline-items";
import type { Milestone, Task } from "@/hooks/use-tasks";
import { DEFAULT_TASK_COLOR, mapProjectData } from "./map-items";

function task(partial: Partial<Task>): Task {
	return {
		id: "t",
		projectId: "p",
		parentId: null,
		name: "T",
		description: null,
		statusId: "s",
		priority: "none",
		progress: 0,
		startDate: null,
		endDate: null,
		color: null,
		assigneeId: null,
		position: 0,
		createdAt: "2026-06-01T00:00:00Z",
		updatedAt: "2026-06-01T00:00:00Z",
		...partial,
	};
}

describe("mapProjectData", () => {
	it("maps a dated task to a timeline bar with color fallback", () => {
		const { items } = mapProjectData(
			[
				task({
					id: "t1",
					name: "Alpha",
					startDate: "2026-06-01",
					endDate: "2026-06-03",
					progress: 40,
				}),
			],
			[],
		);
		expect(items).toEqual([
			{
				id: "t1",
				kind: "task",
				name: "Alpha",
				parentId: null,
				startDate: "2026-06-01",
				endDate: "2026-06-03",
				progress: 40,
				color: DEFAULT_TASK_COLOR,
			},
		]);
	});

	it("backfills a missing end from start (and vice versa)", () => {
		const { items } = mapProjectData(
			[task({ id: "t2", startDate: "2026-06-05", endDate: null })],
			[],
		);
		expect(items[0].startDate).toBe("2026-06-05");
		expect(items[0].endDate).toBe("2026-06-05");
	});

	it("routes a task with no dates to undatedTaskRows", () => {
		const { items, undatedTaskRows } = mapProjectData(
			[task({ id: "t3", name: "NoDates", parentId: "p1" })],
			[],
		);
		expect(items).toHaveLength(0);
		expect(undatedTaskRows).toEqual([
			{ id: "t3", name: "NoDates", parentId: "p1" },
		]);
	});

	it("preserves a custom task color", () => {
		const { items } = mapProjectData(
			[
				task({
					id: "t4",
					startDate: "2026-06-01",
					endDate: "2026-06-02",
					color: "#ff0000",
				}),
			],
			[],
		);
		expect(items[0].color).toBe("#ff0000");
	});

	it("maps milestones to markers with color fallback", () => {
		const ms: Milestone = {
			id: "m1",
			projectId: "p",
			name: "Launch",
			description: null,
			date: "2026-07-01",
			color: null,
			position: 0,
			completedAt: null,
		};
		const { milestoneMarkers } = mapProjectData([], [ms]);
		expect(milestoneMarkers).toEqual([
			{
				id: "m1",
				date: "2026-07-01",
				name: "Launch",
				color: DEFAULT_TASK_COLOR,
			},
		]);
	});

	it("resolves assignee from the assigneeById map", () => {
		const maya: TaskAssignee = {
			id: "u_maya",
			name: "Maya Chen",
			avatarUrl: "https://example.com/maya.png",
		};
		const { items } = mapProjectData(
			[
				task({
					id: "t5",
					startDate: "2026-06-01",
					endDate: "2026-06-02",
					assigneeId: "u_maya",
				}),
			],
			[],
			new Map([["u_maya", maya]]),
		);
		expect(items[0].assignee).toEqual(maya);
	});

	it("leaves assignee undefined when the id is unknown or null", () => {
		const maya: TaskAssignee = {
			id: "u_maya",
			name: "Maya Chen",
			avatarUrl: "https://example.com/maya.png",
		};
		const { items } = mapProjectData(
			[
				task({
					id: "t6",
					startDate: "2026-06-01",
					endDate: "2026-06-02",
					assigneeId: "ghost",
				}),
				task({
					id: "t7",
					startDate: "2026-06-01",
					endDate: "2026-06-02",
					assigneeId: null,
				}),
			],
			[],
			new Map([["u_maya", maya]]),
		);
		expect(items[0].assignee).toBeUndefined();
		expect(items[1].assignee).toBeUndefined();
	});
});
