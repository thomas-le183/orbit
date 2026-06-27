// Helpers for deciding whether a bar's label fits inside the bar, and for
// measuring rendered text width. Kept tiny and dependency-free so the fit
// decision is unit-testable without a DOM.

/** Bar font: matches the `text-xs font-medium` bar label styling. */
const BAR_FONT = "500 12px";
/** Horizontal padding inside a bar (`px-2` → 8px each side). */
const BAR_PADDING_PX = 16;
/** Per-character width estimate used when canvas measurement is unavailable. */
const FALLBACK_CHAR_PX = 7;

/**
 * Does `textWidthPx` fit within a bar of `barWidthPx`, allowing for the bar's
 * inner horizontal padding?
 */
export function labelFitsInside(
	barWidthPx: number,
	textWidthPx: number,
	padPx: number = BAR_PADDING_PX,
): boolean {
	return textWidthPx + padPx <= barWidthPx;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
	if (measureCtx !== undefined) return measureCtx;
	try {
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (ctx) {
			const family =
				getComputedStyle(document.documentElement).fontFamily || "sans-serif";
			ctx.font = `${BAR_FONT} ${family}`;
		}
		measureCtx = ctx;
	} catch {
		measureCtx = null;
	}
	return measureCtx;
}

/**
 * Rendered pixel width of `text` at the bar font. Falls back to a
 * character-count estimate when canvas measurement is unavailable (e.g. tests).
 */
export function measureTextWidth(text: string): number {
	const ctx = getMeasureContext();
	const measured = ctx ? ctx.measureText(text).width : 0;
	return measured > 0 ? measured : text.length * FALLBACK_CHAR_PX;
}
