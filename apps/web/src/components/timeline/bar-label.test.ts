import { describe, expect, it } from "vitest";
import { labelFitsInside } from "./bar-label";

describe("labelFitsInside", () => {
	it("fits when text plus padding is within the bar width", () => {
		// 100px text + 16px padding = 116 <= 200
		expect(labelFitsInside(200, 100)).toBe(true);
	});

	it("does not fit when text plus padding exceeds the bar width", () => {
		// 100px text + 16px padding = 116 > 80
		expect(labelFitsInside(80, 100)).toBe(false);
	});

	it("treats the exact boundary as fitting", () => {
		expect(labelFitsInside(116, 100)).toBe(true);
	});

	it("honors a custom padding", () => {
		expect(labelFitsInside(100, 100, 0)).toBe(true);
		expect(labelFitsInside(100, 100, 1)).toBe(false);
	});

	it("a zero-width bar never fits a non-empty label", () => {
		expect(labelFitsInside(0, 50)).toBe(false);
	});
});
