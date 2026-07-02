import { ROW_HEIGHT } from "../layout/row-metrics";

export type Anchor = "start" | "finish";

/** Vertical center (px) of the bar in row `rowIndex`. */
export function rowCenterY(rowIndex: number): number {
	return rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** Horizontal approach gap (px) between the vertical run and the target edge. */
export const CONNECTOR_GAP = 16;

/** Corner radius (px) applied to each bend of a connector. */
export const CORNER_RADIUS = 4;

type Point = { x: number; y: number };

/**
 * Orthogonal waypoints from the source anchor `from` to the target anchor `to`.
 * `dir` is the outward horizontal direction of each anchor (+1 = finish/right
 * edge, -1 = start/left edge); a bar always extends INWARD from its anchor.
 *
 * Common case — the target sits clear of the source: a 3-bend route with the
 * vertical run at the horizontal midpoint. That midpoint is outward of both
 * anchors, so no segment enters either bar.
 *
 * Overlap case — the bars share horizontal space (e.g. the source's finish lands
 * PAST the target's start): the midpoint would cut through a bar, so we detour.
 * A short `gap` stub leaves each edge outward and a horizontal jog runs through
 * the row gap between the two bars — so the route never steps on the source or
 * the target bar, whatever the overlap.
 */
export function elbowPoints(
	from: { x: number; y: number; dir: -1 | 1 },
	to: { x: number; y: number; dir: -1 | 1 },
	gap = CONNECTOR_GAP,
): Point[] {
	const midX = (from.x + to.x) / 2;
	// The midpoint clears a bar only when it lands on that anchor's OUTWARD side.
	const sourceClear = Math.sign(midX - from.x) === from.dir;
	const targetClear = Math.sign(midX - to.x) === to.dir;
	if (sourceClear && targetClear) {
		return [
			{ x: from.x, y: from.y },
			{ x: midX, y: from.y },
			{ x: midX, y: to.y },
			{ x: to.x, y: to.y },
		];
	}
	const exitX = from.x + from.dir * gap;
	const entryX = to.x + to.dir * gap;
	// Jog along the boundary of the row gap adjacent to the source (toward the
	// target) — always empty of both the source and target bars.
	const jogY = from.y + (to.y >= from.y ? 1 : -1) * (ROW_HEIGHT / 2);
	return [
		{ x: from.x, y: from.y },
		{ x: exitX, y: from.y },
		{ x: exitX, y: jogY },
		{ x: entryX, y: jogY },
		{ x: entryX, y: to.y },
		{ x: to.x, y: to.y },
	];
}

/**
 * Midpoint of the connector's central segment — the natural spot to anchor the
 * delete affordance so it always sits ON the routed path (the vertical run for a
 * 3-bend, the horizontal jog for the overlap detour).
 */
export function elbowMidpoint(
	from: { x: number; y: number; dir: -1 | 1 },
	to: { x: number; y: number; dir: -1 | 1 },
	gap = CONNECTOR_GAP,
): Point {
	const points = elbowPoints(from, to, gap);
	const i = Math.floor((points.length - 1) / 2);
	const a = points[i];
	const b = points[i + 1];
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Render an orthogonal polyline as an SVG path with `radius`-rounded corners:
 * each interior vertex becomes a quadratic bend that begins/ends `radius` before
 * and after the corner, clamped to half of each adjacent segment so neighbouring
 * bends never overlap.
 */
export function roundedPath(points: Point[], radius = CORNER_RADIUS): string {
	if (points.length < 2) return "";
	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const next = points[i + 1];
		const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
		const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
		const r = Math.min(radius, inLen / 2, outLen / 2);
		if (r === 0) {
			d += ` L ${curr.x} ${curr.y}`;
			continue;
		}
		const sx = curr.x - ((curr.x - prev.x) / inLen) * r;
		const sy = curr.y - ((curr.y - prev.y) / inLen) * r;
		const ex = curr.x + ((next.x - curr.x) / outLen) * r;
		const ey = curr.y + ((next.y - curr.y) / outLen) * r;
		d += ` L ${sx} ${sy} Q ${curr.x} ${curr.y} ${ex} ${ey}`;
	}
	const last = points[points.length - 1];
	d += ` L ${last.x} ${last.y}`;
	return d;
}

/** Right-angle connector from `from` to `to`, rendered with rounded corners. */
export function elbowPath(
	from: { x: number; y: number; dir: -1 | 1 },
	to: { x: number; y: number; dir: -1 | 1 },
	gap = CONNECTOR_GAP,
): string {
	return roundedPath(elbowPoints(from, to, gap), CORNER_RADIUS);
}
