export const DEFAULT_TABLE_WIDTH = 320;
export const MIN_TABLE_WIDTH = 160;
export const MAX_TABLE_WIDTH = 640;

/** Clamp a proposed table width to the allowed range. */
export const clampTableWidth = (
	px: number,
	min: number = MIN_TABLE_WIDTH,
	max: number = MAX_TABLE_WIDTH,
): number => Math.min(Math.max(px, min), max);
