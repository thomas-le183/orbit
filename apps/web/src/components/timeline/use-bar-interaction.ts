import { PX_PER_DAY } from "./controller/geometry";
import { ONE_DAY, toUtcDateString } from "./units/make-units";
import type { RelativeTimeRangeOffset, ZoomLevel } from "./units/types";

export type ResizeEdge = "start" | "end";

/** Pixel delta → whole-day delta at the given zoom (day-snapped). */
export const pxToDays = (dx: number, zoom: ZoomLevel): number => {
	const days = dx / PX_PER_DAY[zoom];
	return days >= 0 ? Math.floor(days + 0.5) : Math.ceil(days - 0.5);
};

export const applyMove = (
	range: RelativeTimeRangeOffset,
	days: number,
): RelativeTimeRangeOffset => ({
	from: range.from + days * ONE_DAY,
	to: range.to + days * ONE_DAY,
});

export const applyResize = (
	range: RelativeTimeRangeOffset,
	edge: ResizeEdge,
	days: number,
	minDays = 1,
): RelativeTimeRangeOffset => {
	const min = minDays * ONE_DAY;
	if (edge === "start") {
		const from = Math.min(range.from + days * ONE_DAY, range.to - min);
		return { from, to: range.to };
	}
	const to = Math.max(range.to + days * ONE_DAY, range.from + min);
	return { from: range.from, to };
};

/** Inverse of layout's ownRange: exclusive `to` (+1 day) → inclusive end date. */
export const rangeToDates = (
	range: RelativeTimeRangeOffset,
	today: number,
): { startDate: string; endDate: string } => ({
	startDate: toUtcDateString(today + range.from),
	endDate: toUtcDateString(today + range.to - ONE_DAY),
});
