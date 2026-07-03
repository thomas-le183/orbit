/** Vertical pixels for one packed sub-lane (bar + gap). */
export const LANE_HEIGHT = 32;
/** Padding trimmed off top/bottom of a bar within its lane. */
export const LANE_PADDING = 4;
/** Padding above/below the stack of lanes inside a group row. */
export const GROUP_PADDING = 8;

/** Total height of a group row holding `laneCount` lanes (min one lane). */
export const groupHeight = (laneCount: number): number =>
	Math.max(laneCount, 1) * LANE_HEIGHT + GROUP_PADDING * 2;
