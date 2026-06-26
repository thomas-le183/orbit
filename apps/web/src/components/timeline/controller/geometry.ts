import type { ZoomLevel } from "../units/types";

const ONE_DAY = 86_400_000;

/** Horizontal scale: how many CSS pixels one calendar day occupies, per zoom level. */
export const PX_PER_DAY: Record<ZoomLevel, number> = {
	weeks: 32,
	months: 8,
	quarters: 2.4,
	years: 0.8,
};

export type Geometry = {
	/** ms-offset-from-today sitting at the left edge (0%) of the viewport. */
	offsetMs: number;
	zoom: ZoomLevel;
	/** viewport width in CSS pixels. */
	viewportWidth: number;
};

/** Pixels per millisecond at the given zoom level. */
export const pxPerMs = (zoom: ZoomLevel): number => PX_PER_DAY[zoom] / ONE_DAY;

/** How many ms of time the viewport spans at the current zoom + width. */
export const msPerViewport = (g: Geometry): number =>
	g.viewportWidth / pxPerMs(g.zoom);

/** Map a ms-offset-from-today to a percentage across the viewport (0% = left edge). */
export const msToPercent = (ms: number, g: Geometry): number =>
	((ms - g.offsetMs) / msPerViewport(g)) * 100;

/** Inverse of msToPercent. */
export const percentToMs = (percent: number, g: Geometry): number =>
	(percent / 100) * msPerViewport(g) + g.offsetMs;

/**
 * Sticky-first-label positioning. Pins a top-row label to the viewport's left edge
 * while its unit still has room, then slides it left so it never escapes its own unit.
 * All values are pixels.
 */
export const stickyLeftPx = (
	naturalLeftPx: number,
	unitRightPx: number,
	labelWidthPx: number,
): number => Math.min(Math.max(0, naturalLeftPx), unitRightPx - labelWidthPx);
