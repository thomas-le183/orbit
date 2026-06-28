import { describe, expect, it } from "vitest";
import { clampTableWidth, MAX_TABLE_WIDTH, MIN_TABLE_WIDTH } from "./divider";
import { contentHeight, ROW_HEIGHT, ROW_PADDING } from "./row-metrics";

describe("clampTableWidth", () => {
	it("passes through an in-range value", () => {
		expect(clampTableWidth(320)).toBe(320);
	});
	it("clamps below the minimum", () => {
		expect(clampTableWidth(10)).toBe(MIN_TABLE_WIDTH);
	});
	it("clamps above the maximum", () => {
		expect(clampTableWidth(9999)).toBe(MAX_TABLE_WIDTH);
	});
	it("honors explicit bounds", () => {
		expect(clampTableWidth(50, 100, 200)).toBe(100);
	});
});

describe("contentHeight", () => {
	it("is rowCount * ROW_HEIGHT + ROW_PADDING", () => {
		expect(contentHeight(5)).toBe(5 * ROW_HEIGHT + ROW_PADDING);
	});
	it("is just the padding for zero rows", () => {
		expect(contentHeight(0)).toBe(ROW_PADDING);
	});
});
