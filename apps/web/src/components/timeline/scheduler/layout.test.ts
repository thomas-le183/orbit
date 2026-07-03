import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { GROUP_PADDING, LANE_HEIGHT } from "./lane-metrics";
import { layoutScheduler } from "./layout";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));
const maya: TaskAssignee = { id: "u_maya", name: "Maya Chen", avatarUrl: "" };

function item(partial: Partial<TimelineItem>): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
		assignee: maya,
		...partial,
	};
}

describe("layoutScheduler", () => {
	it("stacks tops and sums total height across rows", () => {
		const { rows, totalHeight } = layoutScheduler(
			[
				item({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" }),
				item({ id: "b", startDate: "2026-06-05", endDate: "2026-06-15" }),
			],
			"assignee",
			TODAY,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].top).toBe(0);
		// 2 overlapping tasks → 2 lanes.
		expect(rows[0].lanes).toHaveLength(2);
		const expectedHeight = 2 * LANE_HEIGHT + GROUP_PADDING * 2;
		expect(rows[0].height).toBe(expectedHeight);
		expect(totalHeight).toBe(expectedHeight);
	});
});
