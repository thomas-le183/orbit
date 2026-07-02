import type { ZoomLevel } from "./units/types";

/** Calendar year. 1 = January-start fiscal year. */
export const FISCAL_MONTH = 1;

/** How many extra viewport-widths of units to render on each side (windowing buffer). */
export const RENDER_BUFFER_SCREENS = 1;

export const DEFAULT_ZOOM: ZoomLevel = "weeks";

/** Approximate rendered width of a top-row label, used by the sticky-label math. */
export const TOP_LABEL_WIDTH_PX = 64;

/**
 * Floor (in px) for a rendered task-bar's width. At far-out zooms a short task
 * spans a sub-pixel fraction of the viewport; without a floor it collapses to an
 * invisible, ungrabbable sliver. Bars never render narrower than this.
 */
export const MIN_BAR_WIDTH_PX = 8;

/**
 * Below this rendered bar width (px) the two resize handles (~6px each) would
 * overlap and eat the whole bar, leaving no move zone — so we drop them and let
 * the entire (tiny) bar act as the drag-to-move target instead.
 */
export const RESIZE_HANDLE_MIN_BAR_PX = 24;
