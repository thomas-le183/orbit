import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { barHeight, MAX_BAR_HEIGHT, MIN_BAR_HEIGHT } from "./lane-metrics";

function item(estimatedTime?: number): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
		estimatedTime,
	};
}

describe("barHeight", () => {
	it("falls back to MIN_BAR_HEIGHT when estimatedTime is absent", () => {
		expect(barHeight(item(undefined))).toBe(MIN_BAR_HEIGHT);
	});

	it("clamps small estimates to the floor", () => {
		// 60min * 0.2 = 12 → clamped up to 24
		expect(barHeight(item(60))).toBe(MIN_BAR_HEIGHT);
	});

	it("clamps large estimates to the ceiling", () => {
		// 1000min * 0.2 = 200 → clamped down to 96
		expect(barHeight(item(1000))).toBe(MAX_BAR_HEIGHT);
	});

	it("scales linearly in the middle band", () => {
		// 300min * 0.2 = 60
		expect(barHeight(item(300))).toBe(60);
	});
});
