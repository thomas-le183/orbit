import { describe, expect, it } from "vitest";
import { elbowPath, rowCenterY } from "./geometry";

describe("rowCenterY", () => {
	it("returns the vertical center of a row band", () => {
		expect(rowCenterY(0)).toBe(20); // ROW_HEIGHT 40 → 0*40 + 20
		expect(rowCenterY(3)).toBe(140); // 3*40 + 20
	});
});

describe("elbowPath", () => {
	it("routes through the horizontal midpoint between the two points", () => {
		expect(elbowPath({ x: 0, y: 20 }, { x: 100, y: 60 })).toBe(
			"M 0 20 L 50 20 L 50 60 L 100 60",
		);
	});

	it("handles a target to the left of the source", () => {
		expect(elbowPath({ x: 100, y: 20 }, { x: 0, y: 100 })).toBe(
			"M 100 20 L 50 20 L 50 100 L 0 100",
		);
	});
});
