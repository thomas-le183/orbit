import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import {
	barHeight,
	estimateFromDrag,
	MAX_BAR_HEIGHT,
	MIN_BAR_HEIGHT,
} from "./lane-metrics";

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

describe("estimateFromDrag", () => {
	// barHeight band is 24..96px → 120..480 min at 0.2 px/min, snapped to 30.
	it("clamps to the floor when dragged up past the minimum", () => {
		// startHeight 24 (min), dy -100 → clamps to 24px → 120 min
		expect(estimateFromDrag(24, -100)).toBe(120);
	});

	it("clamps to the ceiling when dragged down past the maximum", () => {
		// startHeight 96 (max), dy +100 → clamps to 96px → 480 min
		expect(estimateFromDrag(96, 100)).toBe(480);
	});

	it("snaps to the nearest 30 minutes", () => {
		// startHeight 24, dy +38 → 62px → 310 min → snaps to 300
		expect(estimateFromDrag(24, 38)).toBe(300);
	});

	it("starts from a no-estimate bar height (24px)", () => {
		// startHeight 24, dy +36 → 60px → 300 min
		expect(estimateFromDrag(24, 36)).toBe(300);
	});
});
