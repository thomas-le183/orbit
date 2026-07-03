import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { buildGroupRows } from "./group-rows";

const maya: TaskAssignee = { id: "u_maya", name: "Maya Chen", avatarUrl: "" };
const leo: TaskAssignee = { id: "u_leo", name: "Leo Martins", avatarUrl: "" };

function item(partial: Partial<TimelineItem>): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
		...partial,
	};
}

describe("buildGroupRows", () => {
	it("groups tasks by assignee, sorted by name, unassigned last", () => {
		const rows = buildGroupRows(
			[
				item({ id: "a", assignee: maya }),
				item({ id: "b", assignee: leo }),
				item({ id: "c" }),
			],
			"assignee",
		);
		expect(rows.map((r) => r.key)).toEqual(["u_leo", "u_maya", "unassigned"]);
		expect(rows[2].label).toBe("Unassigned");
		expect(rows[0].tasks.map((t) => t.id)).toEqual(["b"]);
	});

	it("omits the unassigned row when every task has an assignee", () => {
		const rows = buildGroupRows([item({ id: "a", assignee: maya })], "assignee");
		expect(rows.map((r) => r.key)).toEqual(["u_maya"]);
	});

	it("excludes parent tasks (those with children) and milestones", () => {
		const rows = buildGroupRows(
			[
				item({ id: "parent", assignee: maya }),
				item({ id: "child", parentId: "parent", assignee: maya }),
				item({ id: "ms", kind: "milestone", assignee: maya }),
			],
			"assignee",
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].tasks.map((t) => t.id)).toEqual(["child"]);
	});
});
