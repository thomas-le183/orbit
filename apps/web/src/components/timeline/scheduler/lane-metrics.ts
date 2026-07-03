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

/** Pixel height of a bar, from its estimatedTime (minutes), clamped-linear. */
export function barHeight(item: TimelineItem): number {
	if (item.estimatedTime == null) return MIN_BAR_HEIGHT;
	const raw = item.estimatedTime * PX_PER_MINUTE;
	return Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, raw));
}
