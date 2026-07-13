import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { LANE_GAP, MAX_BAR_HEIGHT, MIN_BAR_HEIGHT } from "./lane-metrics";
import { packBars } from "./pack-lanes";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));

function bar(
	id: string,
	startDate: string,
	endDate: string,
	estimatedTime?: number,
): TimelineItem {
	return {
		id,
		kind: "task",
		name: id,
		parentId: null,
		startDate,
		endDate,
		color: "#000",
		estimatedTime,
	};
}

/** Map from bar id → its packed top, for order-independent assertions. */
function topsById(bars: { item: TimelineItem; top: number }[]) {
	return Object.fromEntries(bars.map((b) => [b.item.id, b.top]));
}

describe("packBars", () => {
	it("lays non-overlapping tasks on the same row (top 0)", () => {
		const { bars, height } = packBars(
			[
				bar("a", "2026-06-01", "2026-06-03"),
				bar("b", "2026-06-05", "2026-06-07"),
			],
			TODAY,
		);
		expect(topsById(bars)).toEqual({ a: 0, b: 0 });
		expect(height).toBe(MIN_BAR_HEIGHT);
	});

	it("keeps adjacent (touching) ranges on the same row", () => {
		// a ends 06-03 (inclusive → exclusive 06-04); b starts 06-04.
		const { bars } = packBars(
			[
				bar("a", "2026-06-01", "2026-06-03"),
				bar("b", "2026-06-04", "2026-06-06"),
			],
			TODAY,
		);
		expect(topsById(bars)).toEqual({ a: 0, b: 0 });
	});

	it("stacks overlapping bars, each resting a LANE_GAP below the last", () => {
		const { bars, height } = packBars(
			[
				bar("a", "2026-06-01", "2026-06-10"),
				bar("b", "2026-06-05", "2026-06-15"),
			],
			TODAY,
		);
		const tops = topsById(bars);
		expect(tops.a).toBe(0);
		expect(tops.b).toBe(MIN_BAR_HEIGHT + LANE_GAP);
		expect(height).toBe(MIN_BAR_HEIGHT * 2 + LANE_GAP);
	});

	it("stacks by each bar's own height, not the tallest — a short bar sits flush under a tall one", () => {
		// tall: 1440 min over 1 day → MAX_BAR_HEIGHT; short: no estimate → floor.
		const { bars, height } = packBars(
			[
				bar("tall", "2026-06-01", "2026-06-01", 1440),
				bar("short", "2026-06-01", "2026-06-01"),
			],
			TODAY,
		);
		const tops = topsById(bars);
		expect(tops.tall).toBe(0);
		// Short rests just below the tall bar's actual bottom, not a full second
		// MAX_BAR_HEIGHT lane down.
		expect(tops.short).toBe(MAX_BAR_HEIGHT + LANE_GAP);
		expect(height).toBe(MAX_BAR_HEIGHT + LANE_GAP + MIN_BAR_HEIGHT);
	});

	it("packs two time-disjoint bars onto one row beside a wider neighbor", () => {
		// b and c don't overlap each other, so they share the top row; the wide bar
		// a (which overlaps both) drops to the row beneath them.
		const { bars } = packBars(
			[
				bar("a", "2026-06-01", "2026-06-20"),
				bar("b", "2026-06-01", "2026-06-05"),
				bar("c", "2026-06-10", "2026-06-15"),
			],
			TODAY,
		);
		const tops = topsById(bars);
		expect(tops.b).toBe(0);
		expect(tops.c).toBe(0);
		expect(tops.a).toBe(MIN_BAR_HEIGHT + LANE_GAP);
	});

	it("returns an empty pack for no tasks", () => {
		expect(packBars([], TODAY)).toEqual({ bars: [], height: 0 });
	});
});
