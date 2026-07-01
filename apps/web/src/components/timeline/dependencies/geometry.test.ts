import { describe, expect, it } from "vitest";
import { elbowPath, rowCenterY } from "./geometry";

describe("rowCenterY", () => {
	it("returns the vertical center of a row band", () => {
		expect(rowCenterY(0)).toBe(20); // ROW_HEIGHT 40 → 0*40 + 20
		expect(rowCenterY(3)).toBe(140); // 3*40 + 20
	});
});

describe("elbowPath", () => {
	it("drops the vertical one gap OUTSIDE a start-edge target and stubs in", () => {
		// to.dir -1 (start/left edge): vertical at x2 - gap, then a short stub right.
		expect(elbowPath({ x: 0, y: 20 }, { x: 100, y: 60, dir: -1 }, 14)).toBe(
			"M 0 20 L 86 20 L 86 60 L 100 60",
		);
	});

	it("drops the vertical one gap OUTSIDE a finish-edge target and stubs in", () => {
		// to.dir +1 (finish/right edge): vertical at x2 + gap, then a short stub left.
		expect(elbowPath({ x: 100, y: 20 }, { x: 0, y: 100, dir: 1 }, 14)).toBe(
			"M 100 20 L 14 20 L 14 100 L 0 100",
		);
	});

	it("never places a segment on the target row except the entry stub", () => {
		// The only y === to.y segment runs entryX → to.x (length = gap), so it
		// approaches from outside and cannot cross the target bar.
		const path = elbowPath({ x: 0, y: 0 }, { x: 200, y: 40, dir: -1 }, 16);
		expect(path).toBe("M 0 0 L 184 0 L 184 40 L 200 40");
	});
});
