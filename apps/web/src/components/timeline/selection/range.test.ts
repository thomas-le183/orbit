import { describe, expect, it } from "vitest";
import { rangeIds } from "./range";

const IDS = ["a", "b", "c", "d", "e"];

describe("rangeIds", () => {
	it("returns the inclusive range when anchor is before target", () => {
		expect(rangeIds(IDS, "b", "d")).toEqual(["b", "c", "d"]);
	});
	it("returns the inclusive range when anchor is after target", () => {
		expect(rangeIds(IDS, "d", "b")).toEqual(["b", "c", "d"]);
	});
	it("returns just the target when there is no anchor", () => {
		expect(rangeIds(IDS, null, "c")).toEqual(["c"]);
	});
	it("returns a single id when anchor equals target", () => {
		expect(rangeIds(IDS, "c", "c")).toEqual(["c"]);
	});
	it("returns just the target when the anchor is not in the list", () => {
		expect(rangeIds(IDS, "z", "c")).toEqual(["c"]);
	});
	it("returns empty when the target is not in the list", () => {
		expect(rangeIds(IDS, "a", "z")).toEqual([]);
	});
});
