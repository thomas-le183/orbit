import { describe, expect, it } from "vitest";
import type { TaskAssignee, TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import {
	CREATE_LANE_HEIGHT,
	GROUP_PADDING,
	LANE_GAP,
	MIN_BAR_HEIGHT,
	WORKLOAD_STRIP_HEIGHT,
} from "./lane-metrics";
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
		// 2 overlapping tasks → 2 bars stacked in one column.
		expect(rows[0].bars).toHaveLength(2);
		expect(rows[0].bars.map((b) => b.top)).toEqual([
			0,
			MIN_BAR_HEIGHT + LANE_GAP,
		]);
		const expectedHeight =
			WORKLOAD_STRIP_HEIGHT +
			2 * MIN_BAR_HEIGHT +
			LANE_GAP + // gap between the two stacked bars
			LANE_GAP + // trailing gap before the create strip
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
		// No bars rendered, but the task count is preserved for the header.
		expect(rows[0].bars).toHaveLength(0);
		expect(rows[0].taskCount).toBe(2);
		// Height shrinks to exactly the band.
		expect(rows[0].height).toBe(WORKLOAD_STRIP_HEIGHT);
		expect(totalHeight).toBe(WORKLOAD_STRIP_HEIGHT);
	});

	it("reserves a bar-free create strip below the packed bars", () => {
		const { rows } = layoutScheduler(
			[item({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10" })],
			"assignee",
			TODAY,
		);
		const barBottom = rows[0].bars[0].top + MIN_BAR_HEIGHT;
		// From the last bar's bottom to the row's bottom padding is exactly one
		// trailing gap plus the create strip, so a press there never lands on a bar.
		const bottomInset =
			rows[0].height - WORKLOAD_STRIP_HEIGHT - GROUP_PADDING * 2 - barBottom;
		expect(bottomInset).toBe(LANE_GAP + CREATE_LANE_HEIGHT);
	});
});
