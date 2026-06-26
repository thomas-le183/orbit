import { FISCAL_MONTH, TOP_LABEL_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { stickyLeftPx } from "../controller/geometry";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useZoomLevel,
} from "../controller/hooks";
import { getDayUnits, getUnits, ONE_DAY } from "../units/make-units";
import type { Unit, ZoomLevel } from "../units/types";
import { BottomCell, TopLabel } from "./label";

const monthShort = (ms: number) =>
	new Date(ms).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

const fmtTopLabel = (unitStartMs: number, zoom: ZoomLevel): string => {
	const d = new Date(unitStartMs);
	const isCurrentYear = new Date().getUTCFullYear() === d.getUTCFullYear();
	if (zoom === "weeks" || zoom === "months") {
		const m = monthShort(unitStartMs);
		return isCurrentYear ? m : `${m} '${String(d.getUTCFullYear()).slice(-2)}`;
	}
	// quarters + years: year label
	return String(d.getUTCFullYear());
};

const quarterNumber = (monthZeroBased: number): number =>
	Math.floor(monthZeroBased / 3) + 1;

/** Per-zoom layout: which generator feeds the top row and which the bottom row. */
const topZoomFor: Record<ZoomLevel, ZoomLevel> = {
	weeks: "months",
	months: "months",
	quarters: "years",
	years: "years",
};

export default function TimeUnitsBar() {
	const [zoomLevel] = useZoomLevel();
	const { today, from, to } = useRenderingWindow();
	const { viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	// ── Top row (coarse units) with sticky-first-label ──────────────────────
	const topUnits = getUnits({ from, to }, topZoomFor[zoomLevel], today, FISCAL_MONTH);
	const topRow = topUnits.map((unit) => {
		const naturalLeft = getPercentageOffset(unit.from);
		const unitRight = getPercentageOffset(unit.to);
		// Convert the sticky math to percentages via px using the live viewport width.
		const naturalLeftPx = (naturalLeft / 100) * viewportWidth;
		const unitRightPx = (unitRight / 100) * viewportWidth;
		const leftPx = stickyLeftPx(naturalLeftPx, unitRightPx, TOP_LABEL_WIDTH_PX);
		const leftPercent = viewportWidth > 0 ? (leftPx / viewportWidth) * 100 : naturalLeft;
		return (
			<TopLabel key={today + unit.from} leftPercent={leftPercent}>
				{fmtTopLabel(today + unit.from, zoomLevel)}
			</TopLabel>
		);
	});

	// ── Bottom row (fine units) ─────────────────────────────────────────────
	let bottomUnits: Unit[];
	if (zoomLevel === "weeks") {
		bottomUnits = getDayUnits({ from, to }, today);
	} else if (zoomLevel === "months") {
		bottomUnits = getUnits({ from, to }, "weeks", today, FISCAL_MONTH);
	} else {
		bottomUnits = getUnits({ from, to }, "quarters", today, FISCAL_MONTH);
	}

	const bottomRow = bottomUnits.map((unit) => {
		const left = getPercentageOffset(unit.from);
		const width = getPercentageOffset(unit.to) - left;
		const startMs = today + unit.from;
		const d = new Date(startMs);

		let label: string;
		let withLeftBorder = false;
		if (zoomLevel === "weeks") {
			label = String(d.getUTCDate());
			withLeftBorder = d.getUTCDay() === 1; // Monday
		} else if (zoomLevel === "months") {
			label = String(d.getUTCDate());
		} else if (zoomLevel === "quarters") {
			const q = quarterNumber(d.getUTCMonth());
			label = `Q${q} ${monthShort(startMs)} - ${monthShort(today + unit.to - ONE_DAY)}`;
			withLeftBorder = true;
		} else {
			const q = quarterNumber(d.getUTCMonth());
			label = `Q${q}`;
			withLeftBorder = q === 1;
		}

		return (
			<BottomCell
				key={today + unit.from}
				leftPercent={left}
				widthPercent={width}
				withLeftBorder={withLeftBorder}
			>
				{label}
			</BottomCell>
		);
	});

	return (
		<div className="absolute inset-0 h-full w-full">
			<div
				data-testid="timeline-header-top"
				className="relative h-6 border-b border-border"
			>
				{topRow}
			</div>
			<div data-testid="timeline-header-bottom" className="relative h-6 border-b border-border">
				{bottomRow}
			</div>
		</div>
	);
}
