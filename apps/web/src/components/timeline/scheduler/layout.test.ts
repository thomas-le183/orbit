import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { GROUP_PADDING, LANE_GAP, MIN_BAR_HEIGHT } from "./lane-metrics";
import { layoutScheduler, stackLanes } from "./layout";
import type { PackedBar } from "./pack-lanes";

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
		const expectedHeight = 2 * MIN_BAR_HEIGHT + LANE_GAP + GROUP_PADDING * 2;
		expect(rows[0].height).toBe(expectedHeight);
		expect(totalHeight).toBe(expectedHeight);
	});
});

describe("stackLanes", () => {
	const bar = (estimatedTime?: number): PackedBar => ({
		item: {
			id: "t",
			kind: "task",
			name: "T",
			parentId: null,
			startDate: "2026-06-01",
			endDate: "2026-06-02",
			color: "#000",
			estimatedTime,
		},
		range: { from: 0, to: 1 },
	});

	it("sizes each lane to its tallest bar and stacks tops with a gap", () => {
		// lane 0: max(300→60, 60→24) = 60; lane 1: 1000→clamped 96
		const { lanes, height } = stackLanes([[bar(300), bar(60)], [bar(1000)]]);

		expect(lanes[0].top).toBe(0);
		expect(lanes[0].height).toBe(60);
		expect(lanes[1].top).toBe(60 + LANE_GAP);
		expect(lanes[1].height).toBe(96);
		expect(height).toBe(60 + 96 + LANE_GAP + GROUP_PADDING * 2);
	});

	it("falls back to MIN_BAR_HEIGHT for an empty lane list", () => {
		const { lanes, height } = stackLanes([]);
		expect(lanes).toHaveLength(0);
		expect(height).toBe(MIN_BAR_HEIGHT + GROUP_PADDING * 2);
	});
});
