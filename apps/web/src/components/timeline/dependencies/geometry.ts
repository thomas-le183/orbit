import { ROW_HEIGHT } from "../layout/row-metrics";

export type Anchor = "start" | "finish";

export function rowCenterY(rowIndex: number): number {
	return rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** Horizontal gap (px) between a connector's vertical run and the edge it approaches. */
export const CONNECTOR_GAP = 16;

export const CORNER_RADIUS = 4;

type Point = { x: number; y: number };

/**
 * Orthogonal waypoints from anchor `from` to anchor `to`. `dir` is each anchor's
 * outward direction (+1 = finish/right, -1 = start/left); the bar extends inward.
 */
export function elbowPoints(
	from: { x: number; y: number; dir: -1 | 1 },
	to: { x: number; y: number; dir: -1 | 1 },
	gap = CONNECTOR_GAP,
): Point[] {
	// Same-side (FF/SS): bracket both edges around a vertical run beyond the outer.
	if (from.dir === to.dir) {
		const runX =
			from.dir === 1
				? Math.max(from.x, to.x) + gap
				: Math.min(from.x, to.x) - gap;
		return [
			{ x: from.x, y: from.y },
			{ x: runX, y: from.y },
			{ x: runX, y: to.y },
			{ x: to.x, y: to.y },
		];
	}
	const midX = (from.x + to.x) / 2;
	const sourceClear = Math.sign(midX - from.x) === from.dir;
	const targetClear = Math.sign(midX - to.x) === to.dir;
	// Target clear of the source: turn near the source, else at the safe midpoint.
	if (sourceClear && targetClear) {
		const nearFromX = from.x + from.dir * gap;
		const turnX = Math.sign(nearFromX - to.x) === to.dir ? nearFromX : midX;
		return [
			{ x: from.x, y: from.y },
			{ x: turnX, y: from.y },
			{ x: turnX, y: to.y },
			{ x: to.x, y: to.y },
		];
	}
	// Overlap: stub out of each edge and jog through the row gap, clearing both bars.
	const exitX = from.x + from.dir * gap;
	const entryX = to.x + to.dir * gap;
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

/** Midpoint of the connector's central segment, so an affordance sits ON the path. */
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
 * Render an orthogonal polyline as an SVG path, replacing each interior vertex
 * with a quadratic bend. The radius is clamped to half of each adjacent segment
 * so neighbouring bends never overlap.
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
