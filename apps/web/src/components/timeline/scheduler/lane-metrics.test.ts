import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import {
	barHeight,
	estimateFromDrag,
	MAX_BAR_HEIGHT,
	MAX_ESTIMATE_MIN,
	MIN_BAR_HEIGHT,
	MIN_ESTIMATE_MIN,
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

	it("puts the minimum estimate (and anything below it) at the floor", () => {
		expect(barHeight(item(MIN_ESTIMATE_MIN))).toBe(MIN_BAR_HEIGHT); // 15m
		expect(barHeight(item(5))).toBe(MIN_BAR_HEIGHT); // below 15m → clamped
	});

	it("puts the maximum estimate (and anything above it) at the ceiling", () => {
		expect(barHeight(item(MAX_ESTIMATE_MIN))).toBe(MAX_BAR_HEIGHT); // 24h
		expect(barHeight(item(2000))).toBe(MAX_BAR_HEIGHT); // above 24h → clamped
	});

	it("scales linearly across the 15m..24h band", () => {
		const span = MAX_BAR_HEIGHT - MIN_BAR_HEIGHT;
		// 490m → 1/3 of the range; 965m → 2/3.
		expect(barHeight(item(490))).toBe(MIN_BAR_HEIGHT + span / 3);
		expect(barHeight(item(965))).toBe(MIN_BAR_HEIGHT + (2 * span) / 3);
	});
});

describe("estimateFromDrag", () => {
	// The height band maps to 15..1440 min, snapped to 15.
	it("clamps to the minimum estimate when dragged up past the floor", () => {
		expect(estimateFromDrag(MIN_BAR_HEIGHT, -100)).toBe(MIN_ESTIMATE_MIN); // 15m
	});

	it("clamps to the maximum estimate when dragged down past the ceiling", () => {
		expect(estimateFromDrag(MAX_BAR_HEIGHT, 100)).toBe(MAX_ESTIMATE_MIN); // 24h
	});

	it("maps an interior height and snaps to the nearest 15 minutes", () => {
		const span = MAX_BAR_HEIGHT - MIN_BAR_HEIGHT;
		// Midpoint height → 727.5 min → snaps to 735.
		expect(estimateFromDrag(MIN_BAR_HEIGHT, span / 2)).toBe(735);
		expect(estimateFromDrag(MIN_BAR_HEIGHT, span / 2) % 15).toBe(0);
	});

	it("starts from a no-estimate bar height", () => {
		const span = MAX_BAR_HEIGHT - MIN_BAR_HEIGHT;
		// Quarter height → 371.25 min → snaps to 375.
		expect(estimateFromDrag(MIN_BAR_HEIGHT, span / 4)).toBe(375);
	});
});
