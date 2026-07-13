import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import {
	CREATE_LANE_HEIGHT,
	GROUP_PADDING,
	LANE_GAP,
	MAX_BAR_HEIGHT,
	MIN_BAR_HEIGHT,
	WORKLOAD_STRIP_HEIGHT,
} from "./lane-metrics";
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
		const expectedHeight =
			WORKLOAD_STRIP_HEIGHT +
			2 * MIN_BAR_HEIGHT +
			LANE_GAP +
			LANE_GAP +
			CREATE_LANE_HEIGHT +
			GROUP_PADDING * 2;
		expect(rows[0].height).toBe(expectedHeight);
		expect(totalHeight).toBe(expectedHeight);
	});

	it("collapses a row to just the workload band, dropping its lanes", () => {
		const { rows, totalHeight } = layoutScheduler(
			[
				item({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" }),
				item({ id: "b", startDate: "2026-06-05", endDate: "2026-06-15" }),
			],
			"assignee",
			TODAY,
			[maya],
			new Set([maya.id]),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].collapsed).toBe(true);
		// No lanes rendered, but the task count is preserved for the header.
		expect(rows[0].lanes).toHaveLength(0);
		expect(rows[0].taskCount).toBe(2);
		// Height shrinks to exactly the band.
		expect(rows[0].height).toBe(WORKLOAD_STRIP_HEIGHT);
		expect(totalHeight).toBe(WORKLOAD_STRIP_HEIGHT);
	});
});

describe("stackLanes", () => {
	// Single-day bars, so each bar's per-day effort equals its total estimate.
	const bar = (estimatedTime?: number): PackedBar => ({
		item: {
			id: "t",
			kind: "task",
			name: "T",
			parentId: null,
			startDate: "2026-06-01",
			endDate: "2026-06-01",
			color: "#000",
			estimatedTime,
		},
		range: { from: 0, to: 1 },
	});

	it("sizes each lane to its tallest bar and stacks tops with a gap", () => {
		// lane 0: max(490m/day → 1/3 of the band, 15m/day → floor) = laneA;
		// lane 1: 1440m/day → ceiling.
		const laneA = MIN_BAR_HEIGHT + (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) / 3;
		const { lanes, height } = stackLanes([[bar(490), bar(15)], [bar(1440)]]);

		expect(lanes[0].top).toBe(0);
		expect(lanes[0].height).toBe(laneA);
		expect(lanes[1].top).toBe(laneA + LANE_GAP);
		expect(lanes[1].height).toBe(MAX_BAR_HEIGHT);
		expect(height).toBe(
			laneA +
				MAX_BAR_HEIGHT +
				LANE_GAP +
				LANE_GAP +
				CREATE_LANE_HEIGHT +
				GROUP_PADDING * 2,
		);
	});

	it("reserves a bar-free create lane below the last packed lane", () => {
		const packed = stackLanes([[bar(1440)]]);
		const lastLaneBottom = packed.lanes[0].top + packed.lanes[0].height;
		// The strip between the last lane and the row's bottom padding is exactly
		// one create lane tall, so a press there can never land on a bar.
		expect(packed.height - GROUP_PADDING * 2 - lastLaneBottom).toBe(
			LANE_GAP + CREATE_LANE_HEIGHT,
		);
	});

	it("is one create lane tall for an empty lane list", () => {
		const { lanes, height } = stackLanes([]);
		expect(lanes).toHaveLength(0);
		expect(height).toBe(CREATE_LANE_HEIGHT + GROUP_PADDING * 2);
	});
});
