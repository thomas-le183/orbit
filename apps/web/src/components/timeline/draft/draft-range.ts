import { type Geometry, percentToMs } from "../controller/geometry";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";

/** Default span (inclusive days) when a draft is created by a click, not a drag. */
export const DEFAULT_DRAFT_SPAN_DAYS = 7;
/** Horizontal travel (px) below which a drag counts as a click. */
export const CLICK_THRESHOLD_PX = 4;

/**
 * Map a horizontal pointer drag across the draft lane to an inclusive UTC day
 * range. A near-zero drag (a click) seeds a default span anchored at the day
 * under the cursor. Mirrors items-layer's startTsFromClientX conversion.
 */
export function draftRangeFromDrag(
	startClientX: number,
	currentClientX: number,
	laneRect: Pick<DOMRect, "left" | "width">,
	geom: Geometry,
	today: number,
): { startDate: string; endDate: string } {
	const dayAt = (clientX: number): number => {
		const percent =
			laneRect.width <= 0
				? 0
				: ((clientX - laneRect.left) / laneRect.width) * 100;
		return startOfUtcDay(today + percentToMs(percent, geom));
	};

	if (Math.abs(currentClientX - startClientX) < CLICK_THRESHOLD_PX) {
		const start = dayAt(startClientX);
		return {
			startDate: toUtcDateString(start),
			endDate: toUtcDateString(start + (DEFAULT_DRAFT_SPAN_DAYS - 1) * ONE_DAY),
		};
	}

	const a = dayAt(startClientX);
	const b = dayAt(currentClientX);
	return {
		startDate: toUtcDateString(Math.min(a, b)),
		endDate: toUtcDateString(Math.max(a, b)),
	};
}
