import { describe, expect, it } from "vitest";
import {
	type Geometry,
	msPerViewport,
	msToPercent,
	offsetToCenter,
	percentToMs,
	pxPerMs,
	rangeVisibility,
	stickyLeftPx,
} from "./geometry";

const ONE_DAY = 86_400_000;

describe("pxPerMs", () => {
	it("derives ms scale from PX_PER_DAY", () => {
		// weeks renders 48px per day → 48 / 86_400_000 px per ms
		expect(pxPerMs("weeks")).toBeCloseTo(48 / ONE_DAY, 15);
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

describe("offsetToCenter", () => {
	const g: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 320 };

	it("returns an offset that centers the given ms in the viewport", () => {
		const centered = offsetToCenter(7 * ONE_DAY, g);
		// with that offset, the target ms should map to 50%.
		expect(msToPercent(7 * ONE_DAY, { ...g, offsetMs: centered })).toBeCloseTo(
			50,
			10,
		);
	});

	it("centers today (ms=0) at a negative half-viewport offset", () => {
		expect(offsetToCenter(0, g)).toBeCloseTo(-msPerViewport(g) / 2, 10);
	});
});

describe("rangeVisibility", () => {
	// viewport spans [0, msPerViewport] at offsetMs 0
	const g: Geometry = { offsetMs: 0, zoom: "weeks", viewportWidth: 320 };
	const span = msPerViewport(g);

	it("reports a range inside the viewport as visible", () => {
		expect(rangeVisibility(ONE_DAY, 2 * ONE_DAY, g)).toBe("visible");
	});

	it("reports a range entirely before the left edge as 'left'", () => {
		expect(rangeVisibility(-5 * ONE_DAY, -ONE_DAY, g)).toBe("left");
	});

	it("reports a range entirely past the right edge as 'right'", () => {
		expect(rangeVisibility(span + ONE_DAY, span + 2 * ONE_DAY, g)).toBe(
			"right",
		);
	});

	it("treats a range that straddles the left edge as visible", () => {
		expect(rangeVisibility(-ONE_DAY, ONE_DAY, g)).toBe("visible");
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
