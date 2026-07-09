import { describe, expect, it } from "vitest";
import { ONE_DAY } from "../units/make-units";
import { overlapsRange } from "./overlap";

const day = (n: number) => ({ from: n * ONE_DAY, to: (n + 1) * ONE_DAY });

describe("overlapsRange", () => {
	it("returns false when the range is null", () => {
		expect(overlapsRange(day(0), null)).toBe(false);
	});

	it("returns true when the unit sits inside the range", () => {
		expect(overlapsRange(day(2), { from: 0, to: 5 * ONE_DAY })).toBe(true);
	});

	it("returns true when the unit partially overlaps the range", () => {
		expect(overlapsRange(day(4), { from: 0, to: 5 * ONE_DAY })).toBe(true);
	});

	it("excludes the unit starting exactly at the exclusive end", () => {
		expect(overlapsRange(day(5), { from: 0, to: 5 * ONE_DAY })).toBe(false);
	});

	it("excludes the unit ending exactly at the range start", () => {
		expect(overlapsRange(day(0), { from: ONE_DAY, to: 5 * ONE_DAY })).toBe(
			false,
		);
	});

	it("returns false for a zero-width range", () => {
		expect(overlapsRange(day(0), { from: 0, to: 0 })).toBe(false);
	});
});
