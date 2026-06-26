import { describe, expect, it } from "vitest";
import {
	type Geometry,
	msPerViewport,
	msToPercent,
	percentToMs,
	pxPerMs,
	stickyLeftPx,
} from "./geometry";

const ONE_DAY = 86_400_000;

describe("pxPerMs", () => {
	it("derives ms scale from PX_PER_DAY", () => {
		// weeks renders 32px per day → 32 / 86_400_000 px per ms
		expect(pxPerMs("weeks")).toBeCloseTo(32 / ONE_DAY, 15);
	});
});

describe("msToPercent / percentToMs", () => {
	const g: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 320 };

	it("maps the left edge (offsetMs) to 0%", () => {
		expect(msToPercent(0, g)).toBe(0);
	});

	it("maps one full viewport-worth of ms to 100%", () => {
		expect(msToPercent(msPerViewport(g), g)).toBeCloseTo(100, 10);
	});

	it("respects offsetMs as the 0% anchor", () => {
		const shifted: Geometry = { ...g, offsetMs: 5 * ONE_DAY };
		expect(msToPercent(5 * ONE_DAY, shifted)).toBe(0);
	});

	it("round-trips percent → ms → percent", () => {
		expect(percentToMs(msToPercent(3 * ONE_DAY, g), g)).toBeCloseTo(
			3 * ONE_DAY,
			5,
		);
	});
});

describe("stickyLeftPx", () => {
	it("pins to the left edge (0) while there is room", () => {
		// natural position is off-screen left (-50), plenty of unit width remains
		expect(stickyLeftPx(-50, 400, 60)).toBe(0);
	});

	it("rides at the natural position when fully on-screen", () => {
		expect(stickyLeftPx(120, 500, 60)).toBe(120);
	});

	it("slides left to stay inside its unit as the right edge approaches", () => {
		// unitRightPx (40) - labelWidthPx (60) = -20 → label pushed left
		expect(stickyLeftPx(-50, 40, 60)).toBe(-20);
	});
});
