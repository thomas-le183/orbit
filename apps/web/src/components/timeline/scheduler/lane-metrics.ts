import type { TimelineItem } from "@/data/timeline-items";

/** Bar height for a task with no estimate (milestones, parents). Tunable. */
export const MIN_BAR_HEIGHT = 24;
/** Ceiling so one large estimate can't dominate a row. Tunable. */
export const MAX_BAR_HEIGHT = 96;
/** 0.2 → 480min (8h) reaches MAX; ≤120min sits at MIN. Tunable. */
export const PX_PER_MINUTE = 0.2;
/** Vertical gap between stacked lanes within a group. */
export const LANE_GAP = 8;
/** Padding above/below the stack of lanes inside a group row. */
export const GROUP_PADDING = 8;
/**
 * Empty lane kept below the packed lanes of every group row. Without it a fully
 * packed row leaves no bar-free strip to press on, so drag-to-create becomes
 * unreachable there.
 */
export const CREATE_LANE_HEIGHT = MIN_BAR_HEIGHT;

/** Pixel height of a bar, from its estimatedTime (minutes), clamped-linear. */
export function barHeight(item: TimelineItem): number {
	if (item.estimatedTime == null) return MIN_BAR_HEIGHT;
	const raw = item.estimatedTime * PX_PER_MINUTE;
	return Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, raw));
}

/** Snap granularity (minutes) for the scheduler bar resizer. */
export const ESTIMATE_SNAP_MIN = 30;

/**
 * Bottom-edge drag → snapped estimatedTime (minutes). Height is clamped to the
 * visual band [MIN_BAR_HEIGHT, MAX_BAR_HEIGHT], so the result stays in 120..480
 * min, then snaps to the nearest ESTIMATE_SNAP_MIN.
 */
export function estimateFromDrag(startHeight: number, dy: number): number {
	const h = Math.min(
		MAX_BAR_HEIGHT,
		Math.max(MIN_BAR_HEIGHT, startHeight + dy),
	);
	const raw = h / PX_PER_MINUTE;
	return Math.round(raw / ESTIMATE_SNAP_MIN) * ESTIMATE_SNAP_MIN;
}
