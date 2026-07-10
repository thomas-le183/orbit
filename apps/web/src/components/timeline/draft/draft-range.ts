import { type Geometry, percentToMs } from "../controller/geometry";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";

/** Default span (inclusive days) when a draft is created by a click, not a drag. */
export const DEFAULT_DRAFT_SPAN_DAYS = 7;
/** Horizontal travel (px) below which a drag counts as a click. */
export const CLICK_THRESHOLD_PX = 4;

/**
 * Map a horizontal pointer drag across the draft lane to an inclusive UTC day
 * range. A near-zero drag (a click) seeds a default span anchored at the day
 * under the cursor. Mirrors items-layer's startTsFromClientX conversion.
 *
 * When `forceDrag` is true the click/drag decision is skipped and the drag
 * branch is always taken — used by callers that latch a drag themselves (e.g.
 * useLaneCreate) so a backtrack to within the threshold still maps to the true
 * dragged span rather than the default span.
 */
export function draftRangeFromDrag(
	startClientX: number,
	currentClientX: number,
	laneRect: Pick<DOMRect, "left" | "width">,
	geom: Geometry,
	today: number,
	forceDrag = false,
): { startDate: string; endDate: string } {
	const dayAt = (clientX: number): number => {
		const percent =
			laneRect.width <= 0
				? 0
				: ((clientX - laneRect.left) / laneRect.width) * 100;
		return startOfUtcDay(today + percentToMs(percent, geom));
	};

	if (
		!forceDrag &&
		Math.abs(currentClientX - startClientX) < CLICK_THRESHOLD_PX
	) {
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

/**
 * Inverse of `rangeToDates`: turn an inclusive draft day range into the
 * exclusive-`to` offset range the header consumes, so a create-drag can publish
 * the same axis feedback a move/resize drag does. Returns null for unparseable
 * dates (a draft with no dates yet).
 */
export function draftRangeToOffset(
	startDate: string | undefined,
	endDate: string | undefined,
	today: number,
): RelativeTimeRangeOffset | null {
	if (!startDate || !endDate) return null;
	const from = startOfUtcDay(Date.parse(startDate)) - today;
	const to = startOfUtcDay(Date.parse(endDate)) - today + ONE_DAY;
	if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
	return { from, to };
}
