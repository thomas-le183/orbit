import { FISCAL_MONTH } from "../constants";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useWeekStart,
	useZoomLevel,
} from "../controller/hooks";
import { getDayUnits, getUnits } from "../units/make-units";
import type { ZoomLevel } from "../units/types";
import { isNonWorkingDay } from "../units/working-days";
import { GridUnit, NonWorkingStripe } from "./unit";

/**
 * Zooms where a single day is wide enough for weekend shading to read.
 * Quarters (3.6px/day) and years (1.2px/day) collapse the hatch into noise.
 */
const WEEKEND_STRIPE_ZOOMS: ReadonlySet<ZoomLevel> = new Set([
	"weeks",
	"months",
]);

/** Should this unit draw a right border for the given zoom level? */
function hasRightBorder(
	zoom: string,
	unitToOffset: number,
	today: number,
): boolean {
	switch (zoom) {
		case "weeks": {
			// border on each day
			return true;
		}
		case "months": {
			// border on the last day of a month: the unit's end boundary lands on the 1st of the next month
			return new Date(today + unitToOffset).getUTCDate() === 1;
		}
		default:
			// quarters + years: border on each unit
			return true;
	}
}

export default function TimelineGrid() {
	const [zoomLevel] = useZoomLevel();
	const { today, from, to } = useRenderingWindow();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const weekStart = useWeekStart();

	const units = getUnits(
		{ from, to },
		zoomLevel,
		today,
		FISCAL_MONTH,
		weekStart,
	);
	const weekendDays = WEEKEND_STRIPE_ZOOMS.has(zoomLevel)
		? getDayUnits({ from, to }, today, weekStart).filter((day) =>
				isNonWorkingDay(today + day.from),
			)
		: [];

	if (units.length === 0) return null;

	return (
		<div className="absolute inset-0 h-full w-full">
			{weekendDays.map((day) => {
				const left = getPercentageOffset(day.from);
				const width = getPercentageOffset(day.to) - left;
				return (
					<NonWorkingStripe
						key={`weekend-${today + day.from}`}
						leftPercent={left}
						widthPercent={width}
					/>
				);
			})}
			{units.map((unit) => {
				const left = getPercentageOffset(unit.from);
				const width = getPercentageOffset(unit.to) - left;
				return (
					<GridUnit
						key={today + unit.from}
						leftPercent={left}
						widthPercent={width}
						withRightBorder={hasRightBorder(zoomLevel, unit.to, today)}
					/>
				);
			})}
		</div>
	);
}
