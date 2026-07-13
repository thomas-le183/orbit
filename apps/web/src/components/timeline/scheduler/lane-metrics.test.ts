import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import {
	barHeight,
	MAX_BAR_HEIGHT,
	MAX_PER_DAY_MINUTES,
	MIN_BAR_HEIGHT,
	MIN_PER_DAY_MINUTES,
	perDayFromDrag,
	rescaleEstimateForSpan,
} from "./lane-metrics";

/** Single-day task, so its per-day effort equals its total estimate. */
function item(estimatedTime?: number): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-01",
		color: "#000",
		estimatedTime,
	};
}

/** Task spanning `days` inclusive days from 2026-06-01. */
function spanItem(estimatedTime: number, days: number): TimelineItem {
	const end = new Date(Date.UTC(2026, 5, days)); // day 1 = 06-01
	return {
		...item(estimatedTime),
		endDate: end.toISOString().slice(0, 10),
	};
}

describe("barHeight", () => {
	it("falls back to MIN_BAR_HEIGHT when estimatedTime is absent", () => {
		expect(barHeight(item(undefined))).toBe(MIN_BAR_HEIGHT);
	});

	it("puts the minimum per-day effort (and anything below it) at the floor", () => {
		expect(barHeight(item(MIN_PER_DAY_MINUTES))).toBe(MIN_BAR_HEIGHT); // 15m/day
		expect(barHeight(item(5))).toBe(MIN_BAR_HEIGHT); // below 15m → clamped
	});

	it("puts the maximum per-day effort (and anything above it) at the ceiling", () => {
		expect(barHeight(item(MAX_PER_DAY_MINUTES))).toBe(MAX_BAR_HEIGHT); // 24h/day
		expect(barHeight(item(2000))).toBe(MAX_BAR_HEIGHT); // above 24h → clamped
	});

	it("scales linearly across the 15m..24h per-day band", () => {
		const span = MAX_BAR_HEIGHT - MIN_BAR_HEIGHT;
		// 490m/day → 1/3 of the range; 965m/day → 2/3.
		expect(barHeight(item(490))).toBe(MIN_BAR_HEIGHT + span / 3);
		expect(barHeight(item(965))).toBe(MIN_BAR_HEIGHT + (2 * span) / 3);
	});

	it("uses per-day effort, so the same total draws shorter over more days", () => {
		// 980m over 2 days = 490m/day → the same height as a single 490m day.
		expect(barHeight(spanItem(980, 2))).toBe(barHeight(item(490)));
		// Spread wide enough and a large total flattens toward the floor.
		expect(barHeight(spanItem(600, 60))).toBe(MIN_BAR_HEIGHT); // 10m/day
	});
});

describe("perDayFromDrag", () => {
	// The height band maps to a per-day effort of 15..1440 min, snapped to 15.
	it("clamps to the minimum per-day effort when dragged up past the floor", () => {
		expect(perDayFromDrag(MIN_BAR_HEIGHT, -100)).toBe(MIN_PER_DAY_MINUTES); // 15m
	});

	it("clamps to the maximum per-day effort when dragged down past the ceiling", () => {
		expect(perDayFromDrag(MAX_BAR_HEIGHT, 100)).toBe(MAX_PER_DAY_MINUTES); // 24h
	});

	it("maps an interior height and snaps to the nearest 15 minutes", () => {
		const span = MAX_BAR_HEIGHT - MIN_BAR_HEIGHT;
		// Midpoint height → 727.5 min/day → snaps to 735.
		expect(perDayFromDrag(MIN_BAR_HEIGHT, span / 2)).toBe(735);
		expect(perDayFromDrag(MIN_BAR_HEIGHT, span / 2) % 15).toBe(0);
	});

	it("starts from a no-estimate bar height", () => {
		const span = MAX_BAR_HEIGHT - MIN_BAR_HEIGHT;
		// Quarter height → 371.25 min/day → snaps to 375.
		expect(perDayFromDrag(MIN_BAR_HEIGHT, span / 4)).toBe(375);
	});
});

describe("rescaleEstimateForSpan", () => {
	it("scales the total to hold per-day effort constant when the span grows", () => {
		// 240m over 2 days = 120m/day; over 4 days → 480m.
		expect(rescaleEstimateForSpan(240, 2, 4)).toBe(480);
	});

	it("shrinks the total when the span narrows", () => {
		expect(rescaleEstimateForSpan(480, 4, 1)).toBe(120);
	});

	it("returns null when there is no estimate or the old span is invalid", () => {
		expect(rescaleEstimateForSpan(null, 2, 4)).toBeNull();
		expect(rescaleEstimateForSpan(undefined, 2, 4)).toBeNull();
		expect(rescaleEstimateForSpan(240, 0, 4)).toBeNull();
	});
});
