import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { packLanes } from "./pack-lanes";

const TODAY = startOfUtcDay(Date.parse("2026-06-01"));

function bar(id: string, startDate: string, endDate: string): TimelineItem {
	return {
		id,
		kind: "task",
		name: id,
		parentId: null,
		startDate,
		endDate,
		color: "#000",
	};
}

describe("packLanes", () => {
	it("places non-overlapping tasks on a single lane", () => {
		const lanes = packLanes(
			[bar("a", "2026-06-01", "2026-06-03"), bar("b", "2026-06-05", "2026-06-07")],
			TODAY,
		);
		expect(lanes).toHaveLength(1);
		expect(lanes[0].map((p) => p.item.id)).toEqual(["a", "b"]);
	});

	it("splits overlapping tasks into separate lanes", () => {
		const lanes = packLanes(
			[bar("a", "2026-06-01", "2026-06-10"), bar("b", "2026-06-05", "2026-06-15")],
			TODAY,
		);
		expect(lanes).toHaveLength(2);
	});

	it("keeps adjacent (touching) ranges on the same lane", () => {
		// a ends 06-03 (inclusive → exclusive 06-04); b starts 06-04.
		const lanes = packLanes(
			[bar("a", "2026-06-01", "2026-06-03"), bar("b", "2026-06-04", "2026-06-06")],
			TODAY,
		);
		expect(lanes).toHaveLength(1);
	});

	it("returns an empty array for no tasks", () => {
		expect(packLanes([], TODAY)).toEqual([]);
	});
});
