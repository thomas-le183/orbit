import type { TimelineItem } from "@/data/timeline-items";
import { spanDays } from "./workload";

/** Bar height for a task with no estimate (milestones, parents). Tunable. */
export const MIN_BAR_HEIGHT = 16;
/** Ceiling so one intense day can't dominate a row. Tunable. */
export const MAX_BAR_HEIGHT = 160;
/**
 * Per-day effort (minutes) that sits at MIN_BAR_HEIGHT — the lightest day a bar
 * can express before flattening to the floor.
 */
export const MIN_PER_DAY_MINUTES = 15;
/**
 * Per-day effort (minutes) that reaches MAX_BAR_HEIGHT — a fully packed 24h day.
 */
export const MAX_PER_DAY_MINUTES = 24 * 60;
/** Vertical gap between stacked lanes within a group. */
export const LANE_GAP = 8;
/** Padding above/below the stack of lanes inside a group row. */
export const GROUP_PADDING = 8;
/**
 * Height reserved at the top of every assignee row for the per-day workload
 * band. Baked into the row height in `layoutScheduler` and used as the top
 * inset for lanes and the create surface.
 */
export const WORKLOAD_STRIP_HEIGHT = 40;
/**
 * Empty lane kept below the packed lanes of every group row. Without it a fully
 * packed row leaves no bar-free strip to press on, so drag-to-create becomes
 * unreachable there. Fixed (not tied to MIN_BAR_HEIGHT) so it stays comfortably
 * pressable even as the minimum bar height shrinks.
 */
export const CREATE_LANE_HEIGHT = 24;

/**
 * A bar's height encodes its **per-day** effort, not its total estimate: total
 * estimate = per-day effort × day span, so the same total draws taller when
 * squeezed into fewer days and shorter when spread wider. The per-day range
 * [MIN_PER_DAY_MINUTES, MAX_PER_DAY_MINUTES] maps linearly onto the visual band
 * [MIN_BAR_HEIGHT, MAX_BAR_HEIGHT], clamped so no bar escapes the band. This
 * keeps a bar's height in step with the workload band above it, which measures
 * the same per-day effort against daily capacity.
 */
export function barHeight(item: TimelineItem): number {
	if (item.estimatedTime == null) return MIN_BAR_HEIGHT;
	const perDay = item.estimatedTime / spanDays(item.startDate, item.endDate);
	return heightFromPerDay(perDay);
}

/** Pixel height for a given per-day effort (minutes), clamped to the band. */
function heightFromPerDay(perDayMinutes: number): number {
	const frac =
		(perDayMinutes - MIN_PER_DAY_MINUTES) /
		(MAX_PER_DAY_MINUTES - MIN_PER_DAY_MINUTES);
	const clamped = Math.min(1, Math.max(0, frac));
	return MIN_BAR_HEIGHT + clamped * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
}

/** Snap granularity (minutes) for the scheduler bar resizer. */
export const ESTIMATE_SNAP_MIN = 15;

/**
 * Bottom-edge drag → snapped **per-day** effort (minutes). Height is clamped to
 * the visual band [MIN_BAR_HEIGHT, MAX_BAR_HEIGHT] (the inverse of `barHeight`),
 * so the per-day value stays within [MIN_PER_DAY_MINUTES, MAX_PER_DAY_MINUTES],
 * then snaps to the nearest ESTIMATE_SNAP_MIN. The caller multiplies by the
 * task's day span to get the new total estimate.
 */
export function perDayFromDrag(startHeight: number, dy: number): number {
	const h = Math.min(
		MAX_BAR_HEIGHT,
		Math.max(MIN_BAR_HEIGHT, startHeight + dy),
	);
	const frac = (h - MIN_BAR_HEIGHT) / (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
	const raw =
		MIN_PER_DAY_MINUTES + frac * (MAX_PER_DAY_MINUTES - MIN_PER_DAY_MINUTES);
	const snapped = Math.round(raw / ESTIMATE_SNAP_MIN) * ESTIMATE_SNAP_MIN;
	return Math.min(MAX_PER_DAY_MINUTES, Math.max(MIN_PER_DAY_MINUTES, snapped));
}

/**
 * Rescale a task's total estimate to a new day span while holding its per-day
 * effort constant — the horizontal counterpart to `perDayFromDrag`. Widening a
 * bar adds days of the same intensity (more total); narrowing removes them.
 * Returns null when there is no estimate to carry over.
 */
export function rescaleEstimateForSpan(
	estimatedTime: number | null | undefined,
	oldSpanDays: number,
	newSpanDays: number,
): number | null {
	if (estimatedTime == null || oldSpanDays <= 0) return null;
	const perDay = estimatedTime / oldSpanDays;
	return Math.round(perDay * newSpanDays);
}
