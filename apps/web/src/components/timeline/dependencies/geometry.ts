import { ROW_HEIGHT } from "../layout/row-metrics";

export type Anchor = "start" | "finish";

/** Vertical center (px) of the bar in row `rowIndex`. */
export function rowCenterY(rowIndex: number): number {
	return rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/**
 * Right-angle connector from `from` to `to`, routed through the horizontal
 * midpoint so the vertical run sits between the two bars. Rounded corners are
 * applied by the consumer via `stroke-linejoin: round`.
 */
export function elbowPath(
	from: { x: number; y: number },
	to: { x: number; y: number },
): string {
	const midX = (from.x + to.x) / 2;
	return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}
