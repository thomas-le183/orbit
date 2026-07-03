import { describe, expect, it } from "vitest";
import { startOfUtcDay } from "./units/make-units";
import {
	applyMove,
	applyResize,
	gestureTooltip,
	pxToDays,
	rangeToDates,
} from "./use-bar-interaction";

const ONE_DAY = 86_400_000;
const range = { from: 0, to: 3 * ONE_DAY }; // 3-day task starting today
const today = startOfUtcDay(Date.parse("2026-06-01"));

describe("pxToDays", () => {
	it("converts pixels to whole days at the zoom's px/day, rounding", () => {
		// weeks = 32 px/day
		expect(pxToDays(64, "weeks")).toBe(2);
		expect(pxToDays(40, "weeks")).toBe(1); // 1.25 → 1
		expect(pxToDays(-48, "weeks")).toBe(-2); // -1.5 → -2 (round half away)
	});

	it("uses the zoom's scale (months = 8 px/day)", () => {
		expect(pxToDays(24, "months")).toBe(3);
	});
});

describe("applyMove", () => {
	it("shifts both edges by the day delta", () => {
		expect(applyMove(range, 2)).toEqual({ from: 2 * ONE_DAY, to: 5 * ONE_DAY });
		expect(applyMove(range, -1)).toEqual({ from: -ONE_DAY, to: 2 * ONE_DAY });
	});
});

describe("applyResize", () => {
	it("moves the start edge", () => {
		expect(applyResize(range, "start", 1)).toEqual({
			from: ONE_DAY,
			to: 3 * ONE_DAY,
		});
	});

	it("moves the end edge", () => {
		expect(applyResize(range, "end", 2)).toEqual({ from: 0, to: 5 * ONE_DAY });
	});

	it("clamps start so duration stays >= 1 day", () => {
		// pushing start past end-1day is blocked
		expect(applyResize(range, "start", 10)).toEqual({
			from: 2 * ONE_DAY,
			to: 3 * ONE_DAY,
		});
	});

	it("clamps end so duration stays >= 1 day", () => {
		expect(applyResize(range, "end", -10)).toEqual({ from: 0, to: ONE_DAY });
	});
});

describe("rangeToDates", () => {
	it("round-trips a range back to inclusive ISO dates", () => {
		expect(rangeToDates({ from: 0, to: 3 * ONE_DAY }, today)).toEqual({
			startDate: "2026-06-01",
			endDate: "2026-06-03", // exclusive `to` (+1 day) → inclusive end
		});
	});
});

describe("gestureTooltip", () => {
	it("labels the inclusive end date when resizing the end edge", () => {
		const t = gestureTooltip("resize-end", { from: 0, to: 3 * ONE_DAY }, today);
		expect(t.ms).toBe(3 * ONE_DAY);
		expect(t.label).toBe("Jun 3");
	});

	it("labels the start date when resizing the start edge", () => {
		const t = gestureTooltip(
			"resize-start",
			{ from: 0, to: 3 * ONE_DAY },
			today,
		);
		expect(t.ms).toBe(0);
		expect(t.label).toBe("Jun 1");
	});

	it("labels the full span when moving", () => {
		const t = gestureTooltip("move", { from: 0, to: 3 * ONE_DAY }, today);
		expect(t.ms).toBe(0);
		expect(t.label).toBe("Jun 1 – Jun 3");
	});
});
