import { describe, expect, it } from "vitest";
import {
	getDayUnits,
	getMonthUnits,
	getQuarterUnits,
	getTodayColumnIndex,
	getUnits,
	ONE_DAY,
	startOfUtcDay,
	toUtcDateString,
} from "./make-units";

// Wed 10 Jan 2024, 13:45 UTC → start-of-day is Wed 10 Jan 2024 00:00 UTC
const TODAY = startOfUtcDay(Date.UTC(2024, 0, 10, 13, 45));

describe("startOfUtcDay", () => {
	it("zeroes the UTC time-of-day", () => {
		expect(new Date(TODAY).toISOString()).toBe("2024-01-10T00:00:00.000Z");
	});
});

describe("getDayUnits", () => {
	const units = getDayUnits({ from: 0, to: 3 * ONE_DAY }, TODAY);

	it("snaps the first unit back to Monday of the week (Mon 8 Jan = -2 days)", () => {
		expect(units[0].from).toBe(-2 * ONE_DAY);
		expect(units[0].to).toBe(-1 * ONE_DAY);
		expect(units[0].type).toBe("week");
	});

	it("emits one unit per day until past the range end", () => {
		// Mon8, Tue9, Wed10, Thu11, Fri12 → 5 days
		expect(units).toHaveLength(5);
	});

	it("snaps to Sunday when weekStart = 0 (Sun 7 Jan = -3 days)", () => {
		const sundayUnits = getDayUnits({ from: 0, to: 3 * ONE_DAY }, TODAY, 0);
		expect(sundayUnits[0].from).toBe(-3 * ONE_DAY);
	});
});

describe("getTodayColumnIndex", () => {
	it("finds the unit straddling today (from <= 0 < to)", () => {
		const units = getDayUnits({ from: 0, to: 3 * ONE_DAY }, TODAY);
		// index 2 is Wed 10 Jan: from 0, to +1 day
		expect(getTodayColumnIndex(units)).toBe(2);
	});
});

describe("getMonthUnits", () => {
	it("snaps the first unit to the 1st of the month", () => {
		const units = getMonthUnits({ from: 0, to: 40 * ONE_DAY }, TODAY);
		// 1 Jan 2024 is 9 days before today
		expect(units[0].from).toBe(-9 * ONE_DAY);
		expect(units[0].type).toBe("month");
	});
});

describe("getQuarterUnits (calendar year, fiscalMonth=1)", () => {
	it("snaps the first unit to the start of the quarter (1 Jan 2024)", () => {
		const units = getQuarterUnits({ from: 0, to: 100 * ONE_DAY }, TODAY, 1);
		expect(units[0].from).toBe(-9 * ONE_DAY);
		expect(units[0].type).toBe("quarter");
	});
});

describe("getUnits dispatch", () => {
	it("routes weeks to week-sized units", () => {
		const units = getUnits({ from: 0, to: 21 * ONE_DAY }, "weeks", TODAY);
		expect(units[0].type).toBe("week");
		// week units are 7 days wide
		expect(units[0].to - units[0].from).toBe(7 * ONE_DAY);
	});

	it("routes years to year-sized units", () => {
		const units = getUnits({ from: 0, to: 400 * ONE_DAY }, "years", TODAY, 1);
		expect(units[0].type).toBe("year");
	});
});

describe("toUtcDateString", () => {
	it("formats the UTC day as YYYY-MM-DD", () => {
		expect(toUtcDateString(Date.parse("2026-06-27T13:45:00Z"))).toBe(
			"2026-06-27",
		);
	});

	it("is stable across the day (uses start of UTC day)", () => {
		const a = toUtcDateString(Date.parse("2026-01-01T00:00:00Z"));
		const b = toUtcDateString(Date.parse("2026-01-01T23:59:59Z"));
		expect(a).toBe("2026-01-01");
		expect(b).toBe("2026-01-01");
	});
});
