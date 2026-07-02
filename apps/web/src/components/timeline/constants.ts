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

/**
 * Width (px) of the auto-scroll zone at each horizontal edge of the timeline
 * viewport. While a bar drag/resize is in progress and the pointer enters this
 * zone, the timeline pans toward that edge so the gesture can reach dates that
 * are off-screen.
 */
export const EDGE_SCROLL_ZONE_PX = 48;

/**
 * Peak auto-scroll speed (px per animation frame) at the very edge of the
 * viewport. Speed ramps linearly from 0 at the inner edge of the zone up to
 * this value once the pointer reaches (or passes) the viewport edge.
 */
export const EDGE_SCROLL_MAX_PX_PER_FRAME = 14;
