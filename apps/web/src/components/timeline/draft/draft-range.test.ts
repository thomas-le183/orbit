import { describe, expect, it } from "vitest";
import type { Geometry } from "../controller/geometry";
import { draftRangeFromDrag } from "./draft-range";

// viewportWidth 480 @ weeks (48px/day) → each 48px lane pixel === 1 calendar day.
const geom: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 480 };
const today = Date.UTC(2026, 6, 1); // 2026-07-01 UTC midnight
const rect = { left: 0, width: 480 };

describe("draftRangeFromDrag", () => {
	it("maps a forward drag to an inclusive UTC day range", () => {
		expect(draftRangeFromDrag(0, 48 * 4, rect, geom, today)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-05",
		});
	});

	it("normalizes a backward drag so start <= end", () => {
		expect(draftRangeFromDrag(48 * 4, 0, rect, geom, today)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-05",
		});
	});

	it("treats a sub-threshold drag as a click and seeds a 7-day span", () => {
		// clientX 100 → day 2026-07-03; +6 days inclusive → 2026-07-09.
		expect(draftRangeFromDrag(100, 101, rect, geom, today)).toEqual({
			startDate: "2026-07-03",
			endDate: "2026-07-09",
		});
	});
});
