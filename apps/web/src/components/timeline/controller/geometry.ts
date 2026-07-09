import type { ZoomLevel } from "../units/types";

const ONE_DAY = 86_400_000;

/** Horizontal scale: how many CSS pixels one calendar day occupies, per zoom level. */
export const PX_PER_DAY: Record<ZoomLevel, number> = {
	weeks: 64,
	months: 24,
	quarters: 3.6,
	years: 1.2,
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

/** offsetMs that places the given ms-offset at the horizontal center of the viewport. */
export const offsetToCenter = (ms: number, g: Geometry): number =>
	ms - msPerViewport(g) / 2;

/** Where a ms range sits relative to the current viewport. */
export type RangeVisibility = "visible" | "left" | "right";

/**
 * Classify a [from, to] ms range against the viewport:
 * - "left"  → entirely past the left edge (scrolled off to the left / earlier)
 * - "right" → entirely past the right edge (off to the right / later)
 * - "visible" → at least partially within the viewport.
 */
export const rangeVisibility = (
	from: number,
	to: number,
	g: Geometry,
): RangeVisibility => {
	const viewEnd = g.offsetMs + msPerViewport(g);
	if (to < g.offsetMs) return "left";
	if (from > viewEnd) return "right";
	return "visible";
};

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
