import { describe, expect, it } from "vitest";
import type { Geometry } from "../controller/geometry";
import { ONE_DAY } from "../units/make-units";
import { draftRangeFromDrag, draftRangeToOffset } from "./draft-range";

// viewportWidth 640 @ weeks (64px/day) → each 64px lane pixel === 1 calendar day.
const geom: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 640 };
const today = Date.UTC(2026, 6, 1); // 2026-07-01 UTC midnight
const rect = { left: 0, width: 640 };

describe("draftRangeFromDrag", () => {
	it("maps a forward drag to an inclusive UTC day range", () => {
		expect(draftRangeFromDrag(0, 64 * 4, rect, geom, today)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-05",
		});
	});

	it("normalizes a backward drag so start <= end", () => {
		expect(draftRangeFromDrag(64 * 4, 0, rect, geom, today)).toEqual({
			startDate: "2026-07-01",
			endDate: "2026-07-05",
		});
	});

	it("treats a sub-threshold drag as a click and seeds a 7-day span", () => {
		// clientX 130 → day 2026-07-03; +6 days inclusive → 2026-07-09.
		expect(draftRangeFromDrag(130, 131, rect, geom, today)).toEqual({
			startDate: "2026-07-03",
			endDate: "2026-07-09",
		});
	});

	it("forceDrag takes the drag branch even below the click threshold", () => {
		// Same sub-threshold delta (start=130, current=132) but forceDrag=true:
		// both endpoints resolve to the day under the cursor → a 1-day span,
		// NOT the 7-day default.
		expect(draftRangeFromDrag(130, 132, rect, geom, today, true)).toEqual({
			startDate: "2026-07-03",
			endDate: "2026-07-03",
		});
	});
});

describe("draftRangeToOffset", () => {
	it("maps an inclusive day range to an exclusive-`to` offset range", () => {
		// 2026-07-01 → offset 0; end day 2026-07-05 spans through 07-06 exclusive.
		expect(draftRangeToOffset("2026-07-01", "2026-07-05", today)).toEqual({
			from: 0,
			to: 5 * ONE_DAY,
		});
	});

	it("gives a single day a one-day-wide span", () => {
		expect(draftRangeToOffset("2026-07-03", "2026-07-03", today)).toEqual({
			from: 2 * ONE_DAY,
			to: 3 * ONE_DAY,
		});
	});

	it("round-trips a dragged range back through draftRangeFromDrag", () => {
		const { startDate, endDate } = draftRangeFromDrag(
			0,
			64 * 4,
			rect,
			geom,
			today,
		);
		expect(draftRangeToOffset(startDate, endDate, today)).toEqual({
			from: 0,
			to: 5 * ONE_DAY,
		});
	});

	it("returns null when either date is missing or unparseable", () => {
		expect(draftRangeToOffset(undefined, "2026-07-05", today)).toBeNull();
		expect(draftRangeToOffset("2026-07-01", undefined, today)).toBeNull();
		expect(draftRangeToOffset("not-a-date", "2026-07-05", today)).toBeNull();
	});
});
