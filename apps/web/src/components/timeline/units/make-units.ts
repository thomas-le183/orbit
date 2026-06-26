import type {
	RelativeTimeRangeOffset,
	Unit,
	UnitType,
	ZoomLevel,
} from "./types";

export const ONE_DAY = 86_400_000;
export const ONE_WEEK = ONE_DAY * 7;

/** Start of the UTC day containing `ts`. */
export const startOfUtcDay = (ts: number): number => {
	const d = new Date(ts);
	d.setUTCHours(0, 0, 0, 0);
	return d.getTime();
};

/** UTC YYYY-MM-DD for the day containing `ts`. */
export const toUtcDateString = (ts: number): string =>
	new Date(startOfUtcDay(ts)).toISOString().slice(0, 10);

/**
 * Walk a UTC date cursor from `today + from` to `today + to`, emitting one unit per step.
 * `initialize` snaps the cursor to the unit boundary; `next` advances one unit.
 */
const makeUnits = (
	{ from, to }: RelativeTimeRangeOffset,
	type: UnitType,
	today: number,
	initialize: (date: Date) => Date,
	next: (date: Date) => Date,
): Unit[] => {
	const toTs = today + to;

	let cursor = new Date(today + from);
	cursor.setUTCHours(0, 0, 0, 0);
	cursor = initialize(cursor);

	const units: Unit[] = [];
	while (cursor.getTime() < toTs) {
		const unitFrom = cursor.getTime() - today;
		cursor = next(cursor);
		const unitTo = cursor.getTime() - today;
		units.push({ from: unitFrom, to: unitTo, type });
	}
	return units;
};

/**
 * Snap a date back to the most recent week-start day.
 * @param weekStart day the week begins on, 0 = Sunday … 6 = Saturday.
 */
const toWeekStart = (date: Date, weekStart: number): Date =>
	new Date(date.getTime() - ((date.getUTCDay() - weekStart + 7) % 7) * ONE_DAY);

export const getDayUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
	weekStart = 1,
): Unit[] =>
	makeUnits(
		range,
		"week",
		today,
		(date) => toWeekStart(date, weekStart),
		(date) => new Date(date.getTime() + ONE_DAY),
	);

export const getWeekUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
	weekStart = 1,
): Unit[] =>
	makeUnits(
		range,
		"week",
		today,
		(date) => toWeekStart(date, weekStart),
		(date) => new Date(date.getTime() + ONE_WEEK),
	);

export const getMonthUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
): Unit[] =>
	makeUnits(
		range,
		"month",
		today,
		(date) => {
			date.setUTCDate(1);
			return date;
		},
		(date) => {
			date.setUTCMonth(date.getUTCMonth() + 1, 1);
			return date;
		},
	);

export const getQuarterUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
	fiscalMonth: number,
): Unit[] => {
	const offset = fiscalMonth - 1;
	return makeUnits(
		range,
		"quarter",
		today,
		(date) => {
			const month = date.getUTCMonth();
			date.setUTCMonth(month - (month % 3) + offset, 1);
			if (fiscalMonth > 1) {
				date.setUTCFullYear(date.getUTCFullYear() - 1);
			}
			return date;
		},
		(date) => {
			date.setUTCMonth(date.getUTCMonth() + 3, 1);
			return date;
		},
	);
};

export const getYearUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
	fiscalMonth: number,
): Unit[] =>
	makeUnits(
		range,
		"year",
		today,
		(date) => {
			date.setUTCMonth(fiscalMonth - 1, 1);
			if (fiscalMonth > 1) {
				date.setUTCFullYear(date.getUTCFullYear() - 1);
			}
			return date;
		},
		(date) => {
			date.setUTCFullYear(date.getUTCFullYear() + 1);
			return date;
		},
	);

/** Generate the time units to render for a zoom level within the given range. */
export const getUnits = (
	range: RelativeTimeRangeOffset,
	zoomLevel: ZoomLevel,
	today: number,
	fiscalMonth = 1,
	weekStart = 1,
): Unit[] => {
	switch (zoomLevel) {
		case "weeks":
			return getWeekUnits(range, today, weekStart);
		case "months":
			return getMonthUnits(range, today);
		case "quarters":
			return getQuarterUnits(range, today, fiscalMonth);
		case "years":
			return getYearUnits(range, today, fiscalMonth);
	}
};

/** Index of the unit straddling today (from <= 0 < to), or -1. */
export const getTodayColumnIndex = (
	units: { from: number; to: number }[],
): number => units.findIndex(({ from, to }) => from <= 0 && to > 0);
