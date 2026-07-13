import type { TimelineItem } from "@/data/timeline-items";

/** Bar height for a task with no estimate (milestones, parents). Tunable. */
export const MIN_BAR_HEIGHT = 16;
/** Ceiling so one large estimate can't dominate a row. Tunable. */
export const MAX_BAR_HEIGHT = 160;
/** Estimate (minutes) that sits at MIN_BAR_HEIGHT — the shortest adjustable bar. */
export const MIN_ESTIMATE_MIN = 15;
/** Estimate (minutes) that reaches MAX_BAR_HEIGHT — a full 24h day. */
export const MAX_ESTIMATE_MIN = 24 * 60;
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
 * Pixel height of a bar from its estimatedTime (minutes). The estimate range
 * [MIN_ESTIMATE_MIN, MAX_ESTIMATE_MIN] maps linearly onto the visual band
 * [MIN_BAR_HEIGHT, MAX_BAR_HEIGHT]; estimates outside that range clamp to the
 * band so no bar ever escapes it.
 */
export function barHeight(item: TimelineItem): number {
	if (item.estimatedTime == null) return MIN_BAR_HEIGHT;
	const frac =
		(item.estimatedTime - MIN_ESTIMATE_MIN) /
		(MAX_ESTIMATE_MIN - MIN_ESTIMATE_MIN);
	const clamped = Math.min(1, Math.max(0, frac));
	return MIN_BAR_HEIGHT + clamped * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
}

/** Snap granularity (minutes) for the scheduler bar resizer. */
export const ESTIMATE_SNAP_MIN = 15;

/**
 * Bottom-edge drag → snapped estimatedTime (minutes). Height is clamped to the
 * visual band [MIN_BAR_HEIGHT, MAX_BAR_HEIGHT] (the inverse of `barHeight`), so
 * the estimate stays within [MIN_ESTIMATE_MIN, MAX_ESTIMATE_MIN], then snaps to
 * the nearest ESTIMATE_SNAP_MIN.
 */
export function estimateFromDrag(startHeight: number, dy: number): number {
	const h = Math.min(
		MAX_BAR_HEIGHT,
		Math.max(MIN_BAR_HEIGHT, startHeight + dy),
	);
	const frac = (h - MIN_BAR_HEIGHT) / (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
	const raw = MIN_ESTIMATE_MIN + frac * (MAX_ESTIMATE_MIN - MIN_ESTIMATE_MIN);
	const snapped = Math.round(raw / ESTIMATE_SNAP_MIN) * ESTIMATE_SNAP_MIN;
	return Math.min(MAX_ESTIMATE_MIN, Math.max(MIN_ESTIMATE_MIN, snapped));
}
