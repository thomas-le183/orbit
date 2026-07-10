import { useRef } from "react";
import { gestureTooltip } from "../bars/use-bar-interaction";
import { FISCAL_MONTH, TOP_LABEL_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { stickyLeftPx } from "../controller/geometry";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useWeekStart,
	useZoomLevel,
} from "../controller/hooks";
import { useDragRange } from "../drag/context";
import { overlapsRange } from "../drag/overlap";
import { getDayUnits, getUnits, ONE_DAY } from "../units/make-units";
import type { Unit, ZoomLevel } from "../units/types";
import { BottomCell, DragAxisLabel, TopLabel } from "./label";

const monthShort = (ms: number) =>
	new Date(ms).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

const monthLong = (ms: number) =>
	new Date(ms).toLocaleString("en-US", { month: "long", timeZone: "UTC" });

/** Two-letter weekday abbreviation, e.g. "Mo", "Tu". */
const weekdayShort = (ms: number) =>
	new Date(ms)
		.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" })
		.slice(0, 2);

/** Midnight (UTC) of the Thursday in the ISO week containing `ms`. */
const isoThursdayMs = (ms: number): number => {
	const d = new Date(ms);
	const dow = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
	d.setUTCDate(d.getUTCDate() - dow + 3);
	return d.getTime();
};

/** ISO-8601 week number (1–53) of the week containing `ms`. */
const isoWeek = (ms: number): number => {
	const thu = isoThursdayMs(ms);
	const firstThu = isoThursdayMs(
		Date.UTC(new Date(thu).getUTCFullYear(), 0, 4),
	);
	return 1 + Math.round((thu - firstThu) / (7 * ONE_DAY));
};

const fmtTopLabel = (unitStartMs: number, zoom: ZoomLevel): string => {
	if (zoom === "weeks") {
		// ISO week number + full month & year of the week (its Thursday, per ISO).
		const thu = isoThursdayMs(unitStartMs);
		return `${isoWeek(unitStartMs)} - ${monthLong(thu)} ${new Date(thu).getUTCFullYear()}`;
	}
	if (zoom === "months") {
		// Full month name + year — no week number.
		const d = new Date(unitStartMs);
		return `${monthLong(unitStartMs)} ${d.getUTCFullYear()}`;
	}
	// quarters + years: year label
	return String(new Date(unitStartMs).getUTCFullYear());
};

const quarterNumber = (monthZeroBased: number): number =>
	Math.floor(monthZeroBased / 3) + 1;

/** Per-zoom layout: which generator feeds the top row and which the bottom row. */
const topZoomFor: Record<ZoomLevel, ZoomLevel> = {
	weeks: "weeks",
	months: "months",
	quarters: "years",
	years: "years",
};

export default function TimeUnitsBar() {
	const [zoomLevel] = useZoomLevel();
	const { today, from, to } = useRenderingWindow();
	const { viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const weekStart = useWeekStart();
	const drag = useDragRange();
	const dragRange = drag?.range ?? null;
	const axisRef = useRef<HTMLDivElement>(null);
	// Weeks/months resolve to day-wide cells, so a drag can tint the exact days.
	const isDayResolution = zoomLevel === "weeks" || zoomLevel === "months";

	// ── Top row (coarse units) with sticky-first-label ──────────────────────
	const topUnits = getUnits(
		{ from, to },
		topZoomFor[zoomLevel],
		today,
		FISCAL_MONTH,
		weekStart,
	);
	const topRow = topUnits.map((unit) => {
		const naturalLeft = getPercentageOffset(unit.from);
		const unitRight = getPercentageOffset(unit.to);
		// Convert the sticky math to percentages via px using the live viewport width.
		const naturalLeftPx = (naturalLeft / 100) * viewportWidth;
		const unitRightPx = (unitRight / 100) * viewportWidth;
		const leftPx = stickyLeftPx(naturalLeftPx, unitRightPx, TOP_LABEL_WIDTH_PX);
		const leftPercent =
			viewportWidth > 0 ? (leftPx / viewportWidth) * 100 : naturalLeft;
		return (
			<TopLabel key={today + unit.from} leftPercent={leftPercent}>
				{fmtTopLabel(today + unit.from, zoomLevel)}
			</TopLabel>
		);
	});

	// ── Bottom row (fine units) ─────────────────────────────────────────────
	let bottomUnits: Unit[];
	if (zoomLevel === "weeks" || zoomLevel === "months") {
		bottomUnits = getDayUnits({ from, to }, today, weekStart);
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
			label = `${weekdayShort(startMs)} ${d.getUTCDate()}`;
			withLeftBorder = d.getUTCDay() === weekStart; // first day of the week
		} else if (zoomLevel === "months") {
			label = String(d.getUTCDate());
			withLeftBorder = d.getUTCDate() === 1; // first day of the month
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
				highlighted={isDayResolution && overlapsRange(unit, dragRange)}
			>
				{label}
			</BottomCell>
		);
	});

	// Coarse zooms (quarters/years) can't tint a precise day, so pin a date-range
	// label to the axis above the cursor instead of tinting a whole (coarse) cell.
	let axisDrag: { centerPercent: number; label: string } | null = null;
	if (dragRange && !isDayResolution) {
		const left = getPercentageOffset(dragRange.from);
		const width = getPercentageOffset(dragRange.to) - left;
		// Anchor the label at the cursor; fall back to the span midpoint when the
		// axis hasn't been measured yet (e.g. first paint, jsdom).
		let centerPercent = left + width / 2;
		const rect = axisRef.current?.getBoundingClientRect();
		if (drag?.pointerX != null && rect && rect.width > 0) {
			centerPercent = ((drag.pointerX - rect.left) / rect.width) * 100;
		}
		axisDrag = {
			centerPercent,
			label: gestureTooltip("move", dragRange, today).label,
		};
	}

	return (
		<div ref={axisRef} className="absolute inset-0 h-full w-full">
			<div
				data-testid="timeline-header-top"
				className="relative h-6 border-b border-border overflow-hidden"
			>
				{topRow}
			</div>
			<div
				data-testid="timeline-header-bottom"
				className="relative h-6 border-b border-border overflow-hidden"
			>
				{bottomRow}
			</div>
			{axisDrag && (
				<DragAxisLabel
					centerPercent={axisDrag.centerPercent}
					label={axisDrag.label}
				/>
			)}
		</div>
	);
}
