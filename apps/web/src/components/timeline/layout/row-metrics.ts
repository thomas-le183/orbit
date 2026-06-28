/** Vertical pixels allotted to one timeline row (table cell and bar lane). */
export const ROW_HEIGHT = 40;
/** Padding trimmed off the top of the stacked rows / bars. */
export const ROW_PADDING = 7;

/** Total stacked height of `rowCount` rows, matching ItemsLayer's content height. */
export const contentHeight = (rowCount: number): number =>
	rowCount * ROW_HEIGHT + ROW_PADDING;

/** Vertical pixel offset of the row at `rowIndex` (matches ItemsLayer + table). */
export const rowTop = (rowIndex: number): number =>
	rowIndex * ROW_HEIGHT + ROW_PADDING;
