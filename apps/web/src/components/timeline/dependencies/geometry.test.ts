import { describe, expect, it } from "vitest";
import {
	elbowMidpoint,
	elbowPath,
	elbowPoints,
	roundedPath,
	rowCenterY,
} from "./geometry";

describe("rowCenterY", () => {
	it("returns the vertical center of a row band", () => {
		expect(rowCenterY(0)).toBe(20); // ROW_HEIGHT 40 → 0*40 + 20
		expect(rowCenterY(3)).toBe(140); // 3*40 + 20
	});
});

describe("elbowPoints", () => {
	it("routes a clean 3-bend when the target sits clear of the source", () => {
		// finish source (dir +1) → start target (dir -1) ahead of it: the midpoint
		// (50) is outward of both anchors, so no detour is needed.
		expect(
			elbowPoints({ x: 0, y: 20, dir: 1 }, { x: 100, y: 60, dir: -1 }, 14),
		).toEqual([
			{ x: 0, y: 20 },
			{ x: 50, y: 20 },
			{ x: 50, y: 60 },
			{ x: 100, y: 60 },
		]);
	});

	it("mirrors the 3-bend for a start source and a finish target", () => {
		expect(
			elbowPoints({ x: 100, y: 20, dir: -1 }, { x: 0, y: 100, dir: 1 }, 14),
		).toEqual([
			{ x: 100, y: 20 },
			{ x: 50, y: 20 },
			{ x: 50, y: 100 },
			{ x: 0, y: 100 },
		]);
	});

	it("detours through the row gap when the source anchor is past the target", () => {
		// Source finish (dir +1, x100) lands PAST the target start (dir -1, x60):
		// the midpoint (80) would cut both bars, so stub out of each edge and jog
		// along the boundary between the two rows (y 40).
		expect(
			elbowPoints({ x: 100, y: 20, dir: 1 }, { x: 60, y: 60, dir: -1 }, 16),
		).toEqual([
			{ x: 100, y: 20 },
			{ x: 116, y: 20 },
			{ x: 116, y: 40 },
			{ x: 44, y: 40 },
			{ x: 44, y: 60 },
			{ x: 60, y: 60 },
		]);
	});

	it("jogs through the gap above the source when the target row is higher", () => {
		// Same overlap, but the target is on an earlier row: the jog runs along the
		// gap on the source's upper side (y 40), still clearing both bars.
		expect(
			elbowPoints({ x: 100, y: 60, dir: 1 }, { x: 60, y: 20, dir: -1 }, 16),
		).toEqual([
			{ x: 100, y: 60 },
			{ x: 116, y: 60 },
			{ x: 116, y: 40 },
			{ x: 44, y: 40 },
			{ x: 44, y: 20 },
			{ x: 60, y: 20 },
		]);
	});
});

describe("elbowMidpoint", () => {
	it("sits on the vertical run of a clean 3-bend", () => {
		expect(
			elbowMidpoint({ x: 0, y: 20, dir: 1 }, { x: 100, y: 60, dir: -1 }, 14),
		).toEqual({ x: 50, y: 40 });
	});

	it("sits on the horizontal jog of the overlap detour", () => {
		// Central segment is the jog (116,40)→(44,40), so the midpoint is the jog's
		// center — not the endpoint midpoint, which would float off the path.
		expect(
			elbowMidpoint({ x: 100, y: 20, dir: 1 }, { x: 60, y: 60, dir: -1 }, 16),
		).toEqual({ x: 80, y: 40 });
	});
});

describe("roundedPath", () => {
	it("replaces each interior corner with a quadratic bend", () => {
		expect(
			roundedPath(
				[
					{ x: 0, y: 20 },
					{ x: 50, y: 20 },
					{ x: 50, y: 60 },
					{ x: 100, y: 60 },
				],
				6,
			),
		).toBe("M 0 20 L 44 20 Q 50 20 50 26 L 50 54 Q 50 60 56 60 L 100 60");
	});

	it("clamps the radius to half of the shortest adjacent segment", () => {
		// The vertical segment is only 8px, so the bend caps at r = 4, not 6.
		expect(
			roundedPath(
				[
					{ x: 0, y: 0 },
					{ x: 0, y: 8 },
					{ x: 40, y: 8 },
				],
				6,
			),
		).toBe("M 0 0 L 0 4 Q 0 8 4 8 L 40 8");
	});
});

describe("elbowPath", () => {
	it("renders the routed waypoints with rounded corners", () => {
		expect(
			elbowPath({ x: 0, y: 20, dir: 1 }, { x: 100, y: 60, dir: -1 }, 14),
		).toBe("M 0 20 L 44 20 Q 50 20 50 26 L 50 54 Q 50 60 56 60 L 100 60");
	});
});
