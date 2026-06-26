import type { ZoomLevel } from "./units/types";

/** Calendar year. 1 = January-start fiscal year. */
export const FISCAL_MONTH = 1;

/** How many extra viewport-widths of units to render on each side (windowing buffer). */
export const RENDER_BUFFER_SCREENS = 1;

export const DEFAULT_ZOOM: ZoomLevel = "weeks";

/** Approximate rendered width of a top-row label, used by the sticky-label math. */
export const TOP_LABEL_WIDTH_PX = 64;
