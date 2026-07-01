import { ROW_HEIGHT } from "../layout/row-metrics";

export type Anchor = "start" | "finish";

/** Vertical center (px) of the bar in row `rowIndex`. */
export function rowCenterY(rowIndex: number): number {
	return rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** Horizontal approach gap (px) between the vertical run and the target edge. */
export const CONNECTOR_GAP = 16;

/**
 * Right-angle connector from `from` to the target anchor `to`. `to.dir` is the
 * outward horizontal direction of the target's anchor (+1 for a finish/right
 * edge, -1 for a start/left edge). The vertical run is placed one `CONNECTOR_GAP`
 * OUTSIDE the target edge, so the only segment on the target's row is a short
 * stub that approaches from outside — the connector never crosses the target
 * bar. Rounded corners come from the consumer's `stroke-linejoin: round`.
 */
export function elbowPath(
	from: { x: number; y: number },
	to: { x: number; y: number; dir: -1 | 1 },
	gap = CONNECTOR_GAP,
): string {
	const entryX = to.x + to.dir * gap;
	return `M ${from.x} ${from.y} L ${entryX} ${from.y} L ${entryX} ${to.y} L ${to.x} ${to.y}`;
}
