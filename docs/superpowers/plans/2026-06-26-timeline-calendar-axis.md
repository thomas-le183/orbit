# Infinite Calendar/Timeline Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a content-agnostic infinite calendar axis (header + gridlines + now-line) for the `apps/web` timeline page, with drag-to-pan and button-based zoom across weeks/months/quarters/years.

**Architecture:** A self-contained "virtual controller" (React context) holds `{ offsetMs, zoomLevel, viewportWidth, today }`. Nothing scrolls natively; every layer maps a timestamp (ms relative to today, UTC) to a viewport percentage via pure geometry functions. A pure unit engine generates the visible time units per zoom level; three presentational layers (grid, header, now-line) render them.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, `date-fns` v4, Vitest + happy-dom + Testing Library, `@orbit/ui` (shadcn-style), `@orbit/shared` (`cn`).

## Global Constraints

- **Package manager:** `pnpm` only. Run web commands from `apps/web` (`cd apps/web`).
- **Tests:** Vitest. Run a single file with `pnpm test <path-substring>` (this maps to `vitest run <filter>`). Globals are enabled, but follow the existing convention of importing `describe/it/expect` from `vitest` explicitly.
- **Imports:** Use the `#/*` path alias for app-internal absolute imports (`#/components/timeline/...`); relative imports within the `timeline/` folder are fine and preferred for siblings. UI components import from `@orbit/ui/components/<name>`. `cn` imports from `@orbit/shared`.
- **TypeScript:** `camelCase` vars/functions, `PascalCase` types/components. No `any`.
- **Styling:** Tailwind v4 utility classes; `cn()` for conditional class merging.
- **All date math in UTC.** Origin is today = `startOfUtcDay(Date.now())`.
- **Branch:** Work on `feat/timeline-calendar-axis` (already created). Commit after every task.
- **No virtualization library** — windowing comes from the rendering window. Do not add `@tanstack/react-virtual`.

---

## File Structure

Under `apps/web/src/components/timeline/` (replaces current stubs):

```
units/types.ts              ZoomLevel, Unit, RelativeTimeRangeOffset, UnitType
units/make-units.ts         startOfUtcDay, ONE_DAY/ONE_WEEK, makeUnits, get*Units, getUnits, getTodayColumnIndex
controller/geometry.ts      PX_PER_DAY, pxPerMs, msToPercent, percentToMs, msPerViewport, stickyLeftPx
controller/context.tsx      TimelineProvider, useTimelineController
controller/hooks.ts         useZoomLevel, useRenderingWindow, useHorizontalPercentageOffset
axis/unit.tsx               GridUnit (one gridline cell)
axis/grid.tsx               TimelineGrid (background gridlines)
header/label.tsx            TopLabel, BottomCell
header/time-units-bar.tsx   TimeUnitsBar (two rows, per-zoom layouts)
now-line.tsx                NowLine
zoom-control.tsx            ZoomControl (segmented buttons)
container/index.tsx         TimelineContainer (assembles provider + layers + interaction)
constants.ts                FISCAL_MONTH default, RENDER_BUFFER_SCREENS, label widths
```

Deletions/replacements: `subheader/index.tsx` (folded into now-line usage), `SCROLL_PADDING` in `constants.ts` (not needed under the virtual model).

---

### Task 1: Types + geometry (pure)

**Files:**
- Create: `apps/web/src/components/timeline/units/types.ts`
- Create: `apps/web/src/components/timeline/controller/geometry.ts`
- Test: `apps/web/src/components/timeline/controller/geometry.test.ts`

**Interfaces:**
- Produces:
  - `type ZoomLevel = 'weeks' | 'months' | 'quarters' | 'years'`
  - `type UnitType = 'day' | 'week' | 'month' | 'quarter' | 'year'`
  - `type Unit = { from: number; to: number; type: UnitType }`
  - `type RelativeTimeRangeOffset = { from: number; to: number }`
  - `type Geometry = { offsetMs: number; zoom: ZoomLevel; viewportWidth: number }`
  - `PX_PER_DAY: Record<ZoomLevel, number>`
  - `pxPerMs(zoom: ZoomLevel): number`
  - `msPerViewport(g: Geometry): number`
  - `msToPercent(ms: number, g: Geometry): number`
  - `percentToMs(percent: number, g: Geometry): number`
  - `stickyLeftPx(naturalLeftPx: number, unitRightPx: number, labelWidthPx: number): number`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/controller/geometry.test.ts`:

```ts
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
		expect(percentToMs(msToPercent(3 * ONE_DAY, g), g)).toBeCloseTo(3 * ONE_DAY, 5);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/controller/geometry.test.ts`
Expected: FAIL — cannot resolve `./geometry`.

- [ ] **Step 3: Write the types**

Create `apps/web/src/components/timeline/units/types.ts`:

```ts
export type ZoomLevel = "weeks" | "months" | "quarters" | "years";

export type UnitType = "day" | "week" | "month" | "quarter" | "year";

/** A horizontal slice of the axis. `from`/`to` are ms offsets relative to today. */
export type Unit = { from: number; to: number; type: UnitType };

/** A time range expressed as ms offsets relative to today. */
export type RelativeTimeRangeOffset = { from: number; to: number };
```

- [ ] **Step 4: Write the geometry implementation**

Create `apps/web/src/components/timeline/controller/geometry.ts`:

```ts
import type { ZoomLevel } from "../units/types";

const ONE_DAY = 86_400_000;

/** Horizontal scale: how many CSS pixels one calendar day occupies, per zoom level. */
export const PX_PER_DAY: Record<ZoomLevel, number> = {
	weeks: 32,
	months: 8,
	quarters: 2.4,
	years: 0.8,
};

export type Geometry = {
	/** ms-offset-from-today sitting at the left edge (0%) of the viewport. */
	offsetMs: number;
	zoom: ZoomLevel;
	/** viewport width in CSS pixels. */
	viewportWidth: number;
};

/** Pixels per millisecond at the given zoom level. */
export const pxPerMs = (zoom: ZoomLevel): number => PX_PER_DAY[zoom] / ONE_DAY;

/** How many ms of time the viewport spans at the current zoom + width. */
export const msPerViewport = (g: Geometry): number => g.viewportWidth / pxPerMs(g.zoom);

/** Map a ms-offset-from-today to a percentage across the viewport (0% = left edge). */
export const msToPercent = (ms: number, g: Geometry): number =>
	((ms - g.offsetMs) / msPerViewport(g)) * 100;

/** Inverse of msToPercent. */
export const percentToMs = (percent: number, g: Geometry): number =>
	(percent / 100) * msPerViewport(g) + g.offsetMs;

/**
 * Sticky-first-label positioning. Pins a top-row label to the viewport's left edge
 * while its unit still has room, then slides it left so it never escapes its own unit.
 * All values are pixels.
 */
export const stickyLeftPx = (
	naturalLeftPx: number,
	unitRightPx: number,
	labelWidthPx: number,
): number => Math.min(Math.max(0, naturalLeftPx), unitRightPx - labelWidthPx);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/controller/geometry.test.ts`
Expected: PASS (all 8 assertions).

- [ ] **Step 6: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/units/types.ts apps/web/src/components/timeline/controller/geometry.ts apps/web/src/components/timeline/controller/geometry.test.ts
git commit -m "feat(timeline): add axis types and pure geometry helpers"
```

---

### Task 2: Unit engine (pure)

**Files:**
- Create: `apps/web/src/components/timeline/units/make-units.ts`
- Test: `apps/web/src/components/timeline/units/make-units.test.ts`

**Interfaces:**
- Consumes: `Unit`, `UnitType`, `RelativeTimeRangeOffset`, `ZoomLevel` from `./types`.
- Produces:
  - `ONE_DAY: number`, `ONE_WEEK: number`
  - `startOfUtcDay(ts: number): number`
  - `getDayUnits(range: RelativeTimeRangeOffset, today: number): Unit[]`
  - `getWeekUnits(range, today): Unit[]`
  - `getMonthUnits(range, today): Unit[]`
  - `getQuarterUnits(range, today, fiscalMonth): Unit[]`
  - `getYearUnits(range, today, fiscalMonth): Unit[]`
  - `getUnits(range: RelativeTimeRangeOffset, zoomLevel: ZoomLevel, today: number, fiscalMonth?: number): Unit[]`
  - `getTodayColumnIndex(units: { from: number; to: number }[]): number`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/units/make-units.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	getDayUnits,
	getMonthUnits,
	getQuarterUnits,
	getTodayColumnIndex,
	getUnits,
	ONE_DAY,
	startOfUtcDay,
} from "./make-units";

// Wed 10 Jan 2024, 13:45 UTC → start-of-day is Wed 10 Jan 2024 00:00 UTC
const TODAY = startOfUtcDay(Date.UTC(2024, 0, 10, 13, 45));

describe("startOfUtcDay", () => {
	it("zeroes the UTC time-of-day", () => {
		expect(new Date(TODAY).toISOString()).toBe("2024-01-10T00:00:00.000Z");
	});
});

describe("getDayUnits", () => {
	const units = getDayUnits({ from: 0, to: 3 * ONE_DAY }, TODAY);

	it("snaps the first unit back to Monday of the week (Mon 8 Jan = -2 days)", () => {
		expect(units[0].from).toBe(-2 * ONE_DAY);
		expect(units[0].to).toBe(-1 * ONE_DAY);
		expect(units[0].type).toBe("week");
	});

	it("emits one unit per day until past the range end", () => {
		// Mon8, Tue9, Wed10, Thu11, Fri12 → 5 days
		expect(units).toHaveLength(5);
	});
});

describe("getTodayColumnIndex", () => {
	it("finds the unit straddling today (from <= 0 < to)", () => {
		const units = getDayUnits({ from: 0, to: 3 * ONE_DAY }, TODAY);
		// index 2 is Wed 10 Jan: from 0, to +1 day
		expect(getTodayColumnIndex(units)).toBe(2);
	});
});

describe("getMonthUnits", () => {
	it("snaps the first unit to the 1st of the month", () => {
		const units = getMonthUnits({ from: 0, to: 40 * ONE_DAY }, TODAY);
		// 1 Jan 2024 is 9 days before today
		expect(units[0].from).toBe(-9 * ONE_DAY);
		expect(units[0].type).toBe("month");
	});
});

describe("getQuarterUnits (calendar year, fiscalMonth=1)", () => {
	it("snaps the first unit to the start of the quarter (1 Jan 2024)", () => {
		const units = getQuarterUnits({ from: 0, to: 100 * ONE_DAY }, TODAY, 1);
		expect(units[0].from).toBe(-9 * ONE_DAY);
		expect(units[0].type).toBe("quarter");
	});
});

describe("getUnits dispatch", () => {
	it("routes weeks to week-sized units", () => {
		const units = getUnits({ from: 0, to: 21 * ONE_DAY }, "weeks", TODAY);
		expect(units[0].type).toBe("week");
		// week units are 7 days wide
		expect(units[0].to - units[0].from).toBe(7 * ONE_DAY);
	});

	it("routes years to year-sized units", () => {
		const units = getUnits({ from: 0, to: 400 * ONE_DAY }, "years", TODAY, 1);
		expect(units[0].type).toBe("year");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/units/make-units.test.ts`
Expected: FAIL — cannot resolve `./make-units`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/timeline/units/make-units.ts`:

```ts
import type { RelativeTimeRangeOffset, Unit, UnitType, ZoomLevel } from "./types";

export const ONE_DAY = 86_400_000;
export const ONE_WEEK = ONE_DAY * 7;

/** Start of the UTC day containing `ts`. */
export const startOfUtcDay = (ts: number): number => {
	const d = new Date(ts);
	d.setUTCHours(0, 0, 0, 0);
	return d.getTime();
};

/**
 * Walk a UTC date cursor from `today + from` to `today + to`, emitting one unit per step.
 * `initialize` snaps the cursor to the unit boundary; `next` advances one unit.
 */
const makeUnits = (
	{ from, to }: RelativeTimeRangeOffset,
	type: UnitType,
	today: number,
	initialize: (date: Date) => Date,
	next: (date: Date) => Date,
): Unit[] => {
	const toTs = today + to;

	let cursor = new Date(today + from);
	cursor.setUTCHours(0, 0, 0, 0);
	cursor = initialize(cursor);

	const units: Unit[] = [];
	while (cursor.getTime() < toTs) {
		const unitFrom = cursor.getTime() - today;
		cursor = next(cursor);
		const unitTo = cursor.getTime() - today;
		units.push({ from: unitFrom, to: unitTo, type });
	}
	return units;
};

const toMonday = (date: Date): Date =>
	new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * ONE_DAY);

export const getDayUnits = (range: RelativeTimeRangeOffset, today: number): Unit[] =>
	makeUnits(range, "week", today, toMonday, (date) => new Date(date.getTime() + ONE_DAY));

export const getWeekUnits = (range: RelativeTimeRangeOffset, today: number): Unit[] =>
	makeUnits(range, "week", today, toMonday, (date) => new Date(date.getTime() + ONE_WEEK));

export const getMonthUnits = (range: RelativeTimeRangeOffset, today: number): Unit[] =>
	makeUnits(
		range,
		"month",
		today,
		(date) => {
			date.setUTCDate(1);
			return date;
		},
		(date) => {
			date.setUTCMonth(date.getUTCMonth() + 1, 1);
			return date;
		},
	);

export const getQuarterUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
	fiscalMonth: number,
): Unit[] => {
	const offset = fiscalMonth - 1;
	return makeUnits(
		range,
		"quarter",
		today,
		(date) => {
			const month = date.getUTCMonth();
			date.setUTCMonth(month - (month % 3) + offset, 1);
			if (fiscalMonth > 1) {
				date.setUTCFullYear(date.getUTCFullYear() - 1);
			}
			return date;
		},
		(date) => {
			date.setUTCMonth(date.getUTCMonth() + 3, 1);
			return date;
		},
	);
};

export const getYearUnits = (
	range: RelativeTimeRangeOffset,
	today: number,
	fiscalMonth: number,
): Unit[] =>
	makeUnits(
		range,
		"year",
		today,
		(date) => {
			date.setUTCMonth(fiscalMonth - 1, 1);
			if (fiscalMonth > 1) {
				date.setUTCFullYear(date.getUTCFullYear() - 1);
			}
			return date;
		},
		(date) => {
			date.setUTCFullYear(date.getUTCFullYear() + 1);
			return date;
		},
	);

/** Generate the time units to render for a zoom level within the given range. */
export const getUnits = (
	range: RelativeTimeRangeOffset,
	zoomLevel: ZoomLevel,
	today: number,
	fiscalMonth = 1,
): Unit[] => {
	switch (zoomLevel) {
		case "weeks":
			return getWeekUnits(range, today);
		case "months":
			return getMonthUnits(range, today);
		case "quarters":
			return getQuarterUnits(range, today, fiscalMonth);
		case "years":
			return getYearUnits(range, today, fiscalMonth);
	}
};

/** Index of the unit straddling today (from <= 0 < to), or -1. */
export const getTodayColumnIndex = (units: { from: number; to: number }[]): number =>
	units.findIndex(({ from, to }) => from <= 0 && to > 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/units/make-units.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/units/make-units.ts apps/web/src/components/timeline/units/make-units.test.ts
git commit -m "feat(timeline): add UTC unit-generation engine"
```

---

### Task 3: Controller context + hooks

**Files:**
- Create: `apps/web/src/components/timeline/constants.ts` (replaces stub content)
- Create: `apps/web/src/components/timeline/controller/context.tsx`
- Create: `apps/web/src/components/timeline/controller/hooks.ts`
- Test: `apps/web/src/components/timeline/controller/hooks.test.tsx`

**Interfaces:**
- Consumes: `ZoomLevel` from `../units/types`; `Geometry`, `msToPercent`, `msPerViewport` from `./geometry`; `startOfUtcDay` from `../units/make-units`.
- Produces:
  - `constants.ts`: `FISCAL_MONTH = 1`, `RENDER_BUFFER_SCREENS = 1`, `DEFAULT_ZOOM: ZoomLevel = 'weeks'`, `TOP_LABEL_WIDTH_PX = 64`
  - `context.tsx`:
    - `type TimelineControllerValue = { today: number; offsetMs: number; zoomLevel: ZoomLevel; viewportWidth: number; setZoomLevel: (z: ZoomLevel) => void; setOffsetMs: (updater: number | ((prev: number) => number)) => void; setViewportWidth: (w: number) => void; }`
    - `TimelineProvider: React.FC<{ children: React.ReactNode; initialZoom?: ZoomLevel }>`
    - `useTimelineController(): TimelineControllerValue`
  - `hooks.ts`:
    - `useZoomLevel(): [ZoomLevel, (z: ZoomLevel) => void]`
    - `useRenderingWindow(): { today: number; from: number; to: number }`
    - `useHorizontalPercentageOffset(): { getPercentageOffset: (ms: number) => number }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/controller/hooks.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./context";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useZoomLevel,
} from "./hooks";

const wrapper = ({ children }: { children: ReactNode }) => (
	<TimelineProvider initialZoom="weeks">{children}</TimelineProvider>
);

describe("useZoomLevel", () => {
	it("exposes the current zoom and updates it", () => {
		const { result } = renderHook(() => useZoomLevel(), { wrapper });
		expect(result.current[0]).toBe("weeks");
		act(() => result.current[1]("months"));
		expect(result.current[0]).toBe("months");
	});
});

describe("useHorizontalPercentageOffset", () => {
	it("maps the left-edge offset to 0%", () => {
		const { result } = renderHook(
			() => ({
				ctrl: useTimelineController(),
				offset: useHorizontalPercentageOffset(),
			}),
			{ wrapper },
		);
		act(() => result.current.ctrl.setViewportWidth(320));
		const leftEdgeMs = result.current.ctrl.offsetMs;
		expect(result.current.offset.getPercentageOffset(leftEdgeMs)).toBeCloseTo(0, 6);
	});
});

describe("useRenderingWindow", () => {
	it("brackets the visible slice with a one-screen buffer each side", () => {
		const { result } = renderHook(
			() => ({ ctrl: useTimelineController(), win: useRenderingWindow() }),
			{ wrapper },
		);
		act(() => result.current.ctrl.setViewportWidth(320));
		const { from, to } = result.current.win;
		// window must be wider than the viewport span and contain offsetMs
		expect(from).toBeLessThan(result.current.ctrl.offsetMs);
		expect(to).toBeGreaterThan(result.current.ctrl.offsetMs);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/controller/hooks.test.tsx`
Expected: FAIL — cannot resolve `./context`.

- [ ] **Step 3: Write the constants**

Replace the contents of `apps/web/src/components/timeline/constants.ts`:

```ts
import type { ZoomLevel } from "./units/types";

/** Calendar year. 1 = January-start fiscal year. */
export const FISCAL_MONTH = 1;

/** How many extra viewport-widths of units to render on each side (windowing buffer). */
export const RENDER_BUFFER_SCREENS = 1;

export const DEFAULT_ZOOM: ZoomLevel = "weeks";

/** Approximate rendered width of a top-row label, used by the sticky-label math. */
export const TOP_LABEL_WIDTH_PX = 64;
```

- [ ] **Step 4: Write the context**

Create `apps/web/src/components/timeline/controller/context.tsx`:

```tsx
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { DEFAULT_ZOOM } from "../constants";
import { startOfUtcDay } from "../units/make-units";
import type { ZoomLevel } from "../units/types";
import { type Geometry, msPerViewport } from "./geometry";

export type TimelineControllerValue = {
	today: number;
	offsetMs: number;
	zoomLevel: ZoomLevel;
	viewportWidth: number;
	setZoomLevel: (z: ZoomLevel) => void;
	setOffsetMs: (updater: number | ((prev: number) => number)) => void;
	setViewportWidth: (w: number) => void;
};

const TimelineContext = createContext<TimelineControllerValue | null>(null);

/** offsetMs that centers today in the viewport for the given geometry. */
const centeredOffset = (zoom: ZoomLevel, viewportWidth: number): number => {
	if (viewportWidth <= 0) return 0;
	const geom: Geometry = { offsetMs: 0, zoom, viewportWidth };
	return -msPerViewport(geom) / 2;
};

export function TimelineProvider({
	children,
	initialZoom = DEFAULT_ZOOM,
}: {
	children: ReactNode;
	initialZoom?: ZoomLevel;
}) {
	const [today] = useState(() => startOfUtcDay(Date.now()));
	const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(initialZoom);
	const [viewportWidth, setViewportWidthState] = useState(0);
	const [offsetMs, setOffsetMsState] = useState(0);

	const setViewportWidth = useCallback(
		(w: number) => {
			setViewportWidthState((prevW) => {
				// On first real measurement, center today.
				if (prevW === 0 && w > 0) {
					setOffsetMsState(centeredOffset(zoomLevel, w));
				}
				return w;
			});
		},
		[zoomLevel],
	);

	const setZoomLevel = useCallback(
		(z: ZoomLevel) => {
			setZoomLevelState(z);
			// Re-anchor today at center on zoom change.
			setOffsetMsState(centeredOffset(z, viewportWidth));
		},
		[viewportWidth],
	);

	const setOffsetMs = useCallback(
		(updater: number | ((prev: number) => number)) => {
			setOffsetMsState((prev) =>
				typeof updater === "function" ? updater(prev) : updater,
			);
		},
		[],
	);

	const value = useMemo<TimelineControllerValue>(
		() => ({
			today,
			offsetMs,
			zoomLevel,
			viewportWidth,
			setZoomLevel,
			setOffsetMs,
			setViewportWidth,
		}),
		[today, offsetMs, zoomLevel, viewportWidth, setZoomLevel, setOffsetMs, setViewportWidth],
	);

	return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimelineController(): TimelineControllerValue {
	const ctx = useContext(TimelineContext);
	if (!ctx) {
		throw new Error("useTimelineController must be used within a TimelineProvider");
	}
	return ctx;
}
```

- [ ] **Step 5: Write the hooks**

Create `apps/web/src/components/timeline/controller/hooks.ts`:

```ts
import { RENDER_BUFFER_SCREENS } from "../constants";
import type { ZoomLevel } from "../units/types";
import { useTimelineController } from "./context";
import { type Geometry, msPerViewport, msToPercent } from "./geometry";

export function useZoomLevel(): [ZoomLevel, (z: ZoomLevel) => void] {
	const { zoomLevel, setZoomLevel } = useTimelineController();
	return [zoomLevel, setZoomLevel];
}

export function useRenderingWindow(): { today: number; from: number; to: number } {
	const { today, offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	const span = msPerViewport({ offsetMs, zoom: zoomLevel, viewportWidth });
	const buffer = span * RENDER_BUFFER_SCREENS;
	return { today, from: offsetMs - buffer, to: offsetMs + span + buffer };
}

export function useHorizontalPercentageOffset(): {
	getPercentageOffset: (ms: number) => number;
} {
	const { offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };
	return { getPercentageOffset: (ms: number) => msToPercent(ms, geom) };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/controller/hooks.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/constants.ts apps/web/src/components/timeline/controller/context.tsx apps/web/src/components/timeline/controller/hooks.ts apps/web/src/components/timeline/controller/hooks.test.tsx
git commit -m "feat(timeline): add virtual scroll controller context and hooks"
```

---

### Task 4: Background grid layer

**Files:**
- Create: `apps/web/src/components/timeline/axis/unit.tsx`
- Create: `apps/web/src/components/timeline/axis/grid.tsx`
- Test: `apps/web/src/components/timeline/axis/grid.test.tsx`

**Interfaces:**
- Consumes: `useRenderingWindow`, `useZoomLevel`, `useHorizontalPercentageOffset` from `../controller/hooks`; `getUnits`, `getTodayColumnIndex`, `ONE_DAY` from `../units/make-units`; `FISCAL_MONTH` from `../constants`; `TimelineProvider`, `useTimelineController` (tests only).
- Produces:
  - `GridUnit: React.FC<{ leftPercent: number; widthPercent: number; withRightBorder: boolean; isToday: boolean }>`
  - `TimelineGrid: React.FC` (default export of `grid.tsx`)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/axis/grid.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimelineGrid from "./grid";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

describe("TimelineGrid", () => {
	it("renders gridline cells once the viewport has a width", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<TimelineGrid />
			</TimelineProvider>,
		);
		const cells = container.querySelectorAll("[data-testid='timeline-grid-unit']");
		expect(cells.length).toBeGreaterThan(0);
	});

	it("highlights exactly one today column", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<TimelineGrid />
			</TimelineProvider>,
		);
		const highlighted = container.querySelectorAll("[data-today='true']");
		expect(highlighted.length).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/axis/grid.test.tsx`
Expected: FAIL — cannot resolve `./grid`.

- [ ] **Step 3: Write the GridUnit**

Create `apps/web/src/components/timeline/axis/unit.tsx`:

```tsx
import { cn } from "@orbit/shared";

export function GridUnit({
	leftPercent,
	widthPercent,
	withRightBorder,
	isToday,
}: {
	leftPercent: number;
	widthPercent: number;
	withRightBorder: boolean;
	isToday: boolean;
}) {
	return (
		<div
			data-testid="timeline-grid-unit"
			data-today={isToday ? "true" : undefined}
			className={cn(
				"absolute top-0 h-full box-border",
				withRightBorder && "border-r border-border",
				isToday && "bg-muted/40",
			)}
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
		/>
	);
}
```

- [ ] **Step 4: Write the grid**

Create `apps/web/src/components/timeline/axis/grid.tsx`:

```tsx
import { FISCAL_MONTH } from "../constants";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useZoomLevel,
} from "../controller/hooks";
import { getTodayColumnIndex, getUnits } from "../units/make-units";
import { GridUnit } from "./unit";

/** Should this unit draw a right border for the given zoom level? */
function hasRightBorder(zoom: string, unitToMs: number, today: number): boolean {
	switch (zoom) {
		case "weeks": {
			// border on each day
			return true;
		}
		case "months": {
			// border on the last day of the month (next day is the 1st)
			return new Date(today + unitToMs).getUTCDate() === 1;
		}
		default:
			// quarters + years: border on each unit
			return true;
	}
}

export default function TimelineGrid() {
	const [zoomLevel] = useZoomLevel();
	const { today, from, to } = useRenderingWindow();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	const units = getUnits({ from, to }, zoomLevel, today, FISCAL_MONTH);
	const todayIndex = getTodayColumnIndex(units);

	if (units.length === 0) return null;

	return (
		<div className="absolute inset-0 h-full w-full">
			{units.map((unit, index) => {
				const left = getPercentageOffset(unit.from);
				const width = getPercentageOffset(unit.to) - left;
				return (
					<GridUnit
						key={today + unit.from}
						leftPercent={left}
						widthPercent={width}
						withRightBorder={hasRightBorder(zoomLevel, unit.to, today)}
						isToday={index === todayIndex}
					/>
				);
			})}
		</div>
	);
}
```

Note: `ONE_DAY` import is used by `hasRightBorder`'s month math indirectly through the unit boundaries; keep the import only if referenced. If lint flags it as unused, remove the `ONE_DAY` import.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/axis/grid.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/axis/unit.tsx apps/web/src/components/timeline/axis/grid.tsx apps/web/src/components/timeline/axis/grid.test.tsx
git commit -m "feat(timeline): add background gridline layer"
```

---

### Task 5: Header layer (two rows)

**Files:**
- Create: `apps/web/src/components/timeline/header/label.tsx`
- Create: `apps/web/src/components/timeline/header/time-units-bar.tsx`
- Test: `apps/web/src/components/timeline/header/time-units-bar.test.tsx`

**Interfaces:**
- Consumes: `useRenderingWindow`, `useZoomLevel`, `useHorizontalPercentageOffset` from `../controller/hooks`; `useTimelineController` from `../controller/context`; `getUnits`, `getDayUnits` from `../units/make-units`; `FISCAL_MONTH`, `TOP_LABEL_WIDTH_PX` from `../constants`; `stickyLeftPx` from `../controller/geometry`.
- Produces:
  - `TopLabel: React.FC<{ leftPercent: number; children: React.ReactNode }>`
  - `BottomCell: React.FC<{ leftPercent: number; widthPercent: number; children: React.ReactNode; withLeftBorder?: boolean }>`
  - `TimeUnitsBar: React.FC` (default export of `time-units-bar.tsx`)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/header/time-units-bar.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "./time-units-bar";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderBar(initialZoom: "weeks" | "months" | "quarters" | "years") {
	return render(
		<TimelineProvider initialZoom={initialZoom}>
			<SizeViewport width={800} />
			<TimeUnitsBar />
		</TimelineProvider>,
	);
}

describe("TimeUnitsBar", () => {
	it("renders a top row and a bottom row", () => {
		const { container } = renderBar("weeks");
		expect(container.querySelector("[data-testid='timeline-header-top']")).not.toBeNull();
		expect(container.querySelector("[data-testid='timeline-header-bottom']")).not.toBeNull();
	});

	it("renders bottom cells for each zoom level without crashing", () => {
		for (const zoom of ["weeks", "months", "quarters", "years"] as const) {
			const { container } = renderBar(zoom);
			const cells = container.querySelectorAll("[data-testid='timeline-header-cell']");
			expect(cells.length).toBeGreaterThan(0);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/header/time-units-bar.test.tsx`
Expected: FAIL — cannot resolve `./time-units-bar`.

- [ ] **Step 3: Write the label primitives**

Create `apps/web/src/components/timeline/header/label.tsx`:

```tsx
import { cn } from "@orbit/shared";
import type { ReactNode } from "react";

export function TopLabel({
	leftPercent,
	children,
}: {
	leftPercent: number;
	children: ReactNode;
}) {
	return (
		<div
			className="absolute top-0 h-full whitespace-nowrap px-2 text-xs font-semibold leading-6 text-muted-foreground"
			style={{ left: `${leftPercent}%` }}
		>
			{children}
		</div>
	);
}

export function BottomCell({
	leftPercent,
	widthPercent,
	children,
	withLeftBorder = false,
}: {
	leftPercent: number;
	widthPercent: number;
	children: ReactNode;
	withLeftBorder?: boolean;
}) {
	return (
		<div
			data-testid="timeline-header-cell"
			className="absolute top-0 h-full overflow-hidden"
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
		>
			<div
				className={cn(
					"box-border h-full whitespace-nowrap text-center text-xs leading-6 text-muted-foreground",
					withLeftBorder && "border-l border-border",
				)}
			>
				{children}
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Write the TimeUnitsBar**

Create `apps/web/src/components/timeline/header/time-units-bar.tsx`:

```tsx
import { FISCAL_MONTH, TOP_LABEL_WIDTH_PX } from "../constants";
import { useTimelineController } from "../controller/context";
import { stickyLeftPx } from "../controller/geometry";
import {
	useHorizontalPercentageOffset,
	useRenderingWindow,
	useZoomLevel,
} from "../controller/hooks";
import { getDayUnits, getUnits, ONE_DAY } from "../units/make-units";
import type { Unit, ZoomLevel } from "../units/types";
import { BottomCell, TopLabel } from "./label";

const monthShort = (ms: number) =>
	new Date(ms).toLocaleString("en-US", { month: "short", timeZone: "UTC" });

const fmtTopLabel = (unitStartMs: number, zoom: ZoomLevel): string => {
	const d = new Date(unitStartMs);
	const isCurrentYear = new Date().getUTCFullYear() === d.getUTCFullYear();
	if (zoom === "weeks" || zoom === "months") {
		const m = monthShort(unitStartMs);
		return isCurrentYear ? m : `${m} ’${String(d.getUTCFullYear()).slice(-2)}`;
	}
	// quarters + years: year label
	return String(d.getUTCFullYear());
};

const quarterNumber = (monthZeroBased: number): number =>
	Math.floor(monthZeroBased / 3) + 1;

/** Per-zoom layout: which generator feeds the top row and which the bottom row. */
const topZoomFor: Record<ZoomLevel, ZoomLevel> = {
	weeks: "months",
	months: "months",
	quarters: "years",
	years: "years",
};

export default function TimeUnitsBar() {
	const [zoomLevel] = useZoomLevel();
	const { today, from, to } = useRenderingWindow();
	const { viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	// ── Top row (coarse units) with sticky-first-label ──────────────────────
	const topUnits = getUnits({ from, to }, topZoomFor[zoomLevel], today, FISCAL_MONTH);
	const topRow = topUnits.map((unit) => {
		const naturalLeft = getPercentageOffset(unit.from);
		const unitRight = getPercentageOffset(unit.to);
		// Convert the sticky math to percentages via px using the live viewport width.
		const naturalLeftPx = (naturalLeft / 100) * viewportWidth;
		const unitRightPx = (unitRight / 100) * viewportWidth;
		const leftPx = stickyLeftPx(naturalLeftPx, unitRightPx, TOP_LABEL_WIDTH_PX);
		const leftPercent = viewportWidth > 0 ? (leftPx / viewportWidth) * 100 : naturalLeft;
		return (
			<TopLabel key={today + unit.from} leftPercent={leftPercent}>
				{fmtTopLabel(today + unit.from, zoomLevel)}
			</TopLabel>
		);
	});

	// ── Bottom row (fine units) ─────────────────────────────────────────────
	let bottomUnits: Unit[];
	if (zoomLevel === "weeks") {
		bottomUnits = getDayUnits({ from, to }, today);
	} else if (zoomLevel === "months") {
		bottomUnits = getUnits({ from, to }, "weeks", today, FISCAL_MONTH);
	} else {
		bottomUnits = getUnits({ from, to }, "quarters", today, FISCAL_MONTH);
	}

	const bottomRow = bottomUnits.map((unit) => {
		const left = getPercentageOffset(unit.from);
		const width = getPercentageOffset(unit.to) - left;
		const startMs = today + unit.from;
		const d = new Date(startMs);

		let label: string;
		let withLeftBorder = false;
		if (zoomLevel === "weeks") {
			label = String(d.getUTCDate());
			withLeftBorder = d.getUTCDay() === 1; // Monday
		} else if (zoomLevel === "months") {
			label = String(d.getUTCDate());
		} else if (zoomLevel === "quarters") {
			const q = quarterNumber(d.getUTCMonth());
			label = `Q${q} ${monthShort(startMs)} - ${monthShort(today + unit.to - ONE_DAY)}`;
			withLeftBorder = true;
		} else {
			const q = quarterNumber(d.getUTCMonth());
			label = `Q${q}`;
			withLeftBorder = q === 1;
		}

		return (
			<BottomCell
				key={today + unit.from}
				leftPercent={left}
				widthPercent={width}
				withLeftBorder={withLeftBorder}
			>
				{label}
			</BottomCell>
		);
	});

	return (
		<div className="absolute inset-0 h-full w-full">
			<div
				data-testid="timeline-header-top"
				className="relative h-6 border-b border-border"
			>
				{topRow}
			</div>
			<div data-testid="timeline-header-bottom" className="relative h-6 border-b border-border">
				{bottomRow}
			</div>
		</div>
	);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/header/time-units-bar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/header/label.tsx apps/web/src/components/timeline/header/time-units-bar.tsx apps/web/src/components/timeline/header/time-units-bar.test.tsx
git commit -m "feat(timeline): add two-row scrolling date header"
```

---

### Task 6: Now-line layer

**Files:**
- Create: `apps/web/src/components/timeline/now-line.tsx`
- Test: `apps/web/src/components/timeline/now-line.test.tsx`

**Interfaces:**
- Consumes: `useHorizontalPercentageOffset` from `./controller/hooks`; `useTimelineController` from `./controller/context`.
- Produces: `NowLine: React.FC` (default export).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/now-line.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { TimelineProvider, useTimelineController } from "./controller/context";
import NowLine from "./now-line";

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

describe("NowLine", () => {
	it("renders the now marker positioned at today (≈50% when centered)", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<SizeViewport width={640} />
				<NowLine />
			</TimelineProvider>,
		);
		const line = container.querySelector("[data-testid='timeline-now-line']");
		expect(line).not.toBeNull();
		const left = Number.parseFloat((line as HTMLElement).style.left);
		// today is centered on first measurement → near 50%
		expect(left).toBeGreaterThan(40);
		expect(left).toBeLessThan(60);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/now-line.test.tsx`
Expected: FAIL — cannot resolve `./now-line`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/timeline/now-line.tsx`:

```tsx
import { useTimelineController } from "./controller/context";
import { useHorizontalPercentageOffset } from "./controller/hooks";

export default function NowLine() {
	const { today } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();

	// today is the origin, so the offset of "today" in ms-relative-to-today is 0.
	const leftPercent = getPercentageOffset(0);

	if (!Number.isFinite(leftPercent)) return null;

	return (
		<div
			data-testid="timeline-now-line"
			className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-sky-500"
			style={{ left: `${leftPercent}%` }}
		>
			<span className="absolute -top-px -left-[3px] h-0 w-0 border-r-4 border-l-4 border-t-[7px] border-r-transparent border-l-transparent border-t-sky-500" />
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/now-line.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/now-line.tsx apps/web/src/components/timeline/now-line.test.tsx
git commit -m "feat(timeline): add today now-line marker"
```

---

### Task 7: Zoom control

**Files:**
- Create: `apps/web/src/components/timeline/zoom-control.tsx`
- Test: `apps/web/src/components/timeline/zoom-control.test.tsx`

**Interfaces:**
- Consumes: `useZoomLevel` from `./controller/hooks`; `ToggleGroup`, `ToggleGroupItem` from `@orbit/ui/components/toggle-group`; `ZoomLevel` from `./units/types`.
- Produces: `ZoomControl: React.FC` (default export).

- [ ] **Step 1: Confirm the ToggleGroup export shape**

Run: `cd /Users/thinhle/Documents/Development/orbit && grep -n "export" packages/ui/src/components/toggle-group.tsx`
Expected: shows `ToggleGroup` and `ToggleGroupItem` exports. If the names differ, adjust the import in Step 3 to match (do not invent names).

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/components/timeline/zoom-control.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TimelineProvider } from "./controller/context";
import { useZoomLevel } from "./controller/hooks";
import ZoomControl from "./zoom-control";

function ZoomReadout() {
	const [zoom] = useZoomLevel();
	return <span data-testid="zoom-readout">{zoom}</span>;
}

describe("ZoomControl", () => {
	it("renders a button per zoom level", () => {
		render(
			<TimelineProvider initialZoom="weeks">
				<ZoomControl />
			</TimelineProvider>,
		);
		for (const label of ["Weeks", "Months", "Quarters", "Years"]) {
			expect(screen.getByRole("radio", { name: label })).toBeTruthy();
		}
	});

	it("changes the controller zoom level when clicked", async () => {
		const user = userEvent.setup();
		render(
			<TimelineProvider initialZoom="weeks">
				<ZoomControl />
				<ZoomReadout />
			</TimelineProvider>,
		);
		await user.click(screen.getByRole("radio", { name: "Quarters" }));
		expect(screen.getByTestId("zoom-readout").textContent).toBe("quarters");
	});
});
```

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/timeline/zoom-control.tsx`:

```tsx
import { ToggleGroup, ToggleGroupItem } from "@orbit/ui/components/toggle-group";
import { useZoomLevel } from "./controller/hooks";
import type { ZoomLevel } from "./units/types";

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
	{ value: "weeks", label: "Weeks" },
	{ value: "months", label: "Months" },
	{ value: "quarters", label: "Quarters" },
	{ value: "years", label: "Years" },
];

export default function ZoomControl() {
	const [zoomLevel, setZoomLevel] = useZoomLevel();

	return (
		<ToggleGroup
			type="single"
			value={zoomLevel}
			onValueChange={(value) => {
				if (value) setZoomLevel(value as ZoomLevel);
			}}
			variant="outline"
			size="sm"
		>
			{ZOOM_OPTIONS.map((option) => (
				<ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
```

Note: `ToggleGroupItem` renders with `role="radio"` for `type="single"`. If the confirmed component does not forward `variant`/`size`, drop those props.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test src/components/timeline/zoom-control.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline/zoom-control.tsx apps/web/src/components/timeline/zoom-control.test.tsx
git commit -m "feat(timeline): add zoom-level control"
```

---

### Task 8: Container (assembly + pan interaction) and route wiring

**Files:**
- Create: `apps/web/src/components/timeline/use-pan.ts`
- Modify: `apps/web/src/components/timeline/container/index.tsx` (replace stub)
- Modify: `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx` (replace placeholder)
- Delete: `apps/web/src/components/timeline/subheader/index.tsx`
- Test: `apps/web/src/components/timeline/container/index.test.tsx`

**Interfaces:**
- Consumes: everything above — `TimelineProvider`, `useTimelineController` (`../controller/context`), `pxPerMs` (`../controller/geometry`), `TimelineGrid` (`../axis/grid`), `TimeUnitsBar` (`../header/time-units-bar`), `NowLine` (`../now-line`), `ZoomControl` (`../zoom-control`).
- Produces:
  - `usePan(): { onPointerDown: (e: React.PointerEvent) => void; onWheel: (e: React.WheelEvent) => void }`
  - `TimelineContainer: React.FC` (default export of `container/index.tsx`)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/container/index.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TimelineContainer from "./index";

describe("TimelineContainer", () => {
	it("mounts the header, grid, now-line and zoom control together", () => {
		const { container } = render(<TimelineContainer />);
		expect(container.querySelector("[data-testid='timeline-header-top']")).not.toBeNull();
		expect(container.querySelector("[data-testid='timeline-now-line']")).not.toBeNull();
		// zoom control radios
		expect(container.querySelectorAll("[role='radio']").length).toBe(4);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test src/components/timeline/container/index.test.tsx`
Expected: FAIL — current stub renders only a text div; assertions fail.

- [ ] **Step 3: Write the pan hook**

Create `apps/web/src/components/timeline/use-pan.ts`:

```ts
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useRef } from "react";
import { useTimelineController } from "./controller/context";
import { pxPerMs } from "./controller/geometry";

/** Pointer-drag + wheel horizontal panning that updates the controller's offsetMs. */
export function usePan() {
	const { zoomLevel, setOffsetMs } = useTimelineController();
	const dragX = useRef<number | null>(null);

	const msPerPx = 1 / pxPerMs(zoomLevel);

	const onPointerDown = (e: ReactPointerEvent) => {
		dragX.current = e.clientX;
		e.currentTarget.setPointerCapture(e.pointerId);

		const onMove = (ev: PointerEvent) => {
			if (dragX.current === null) return;
			const dx = ev.clientX - dragX.current;
			dragX.current = ev.clientX;
			// drag right → reveal earlier time → offsetMs decreases
			setOffsetMs((prev) => prev - dx * msPerPx);
		};
		const onUp = () => {
			dragX.current = null;
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const onWheel = (e: ReactWheelEvent) => {
		const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		setOffsetMs((prev) => prev + dx * msPerPx);
	};

	return { onPointerDown, onWheel };
}
```

- [ ] **Step 4: Write the container**

Replace the contents of `apps/web/src/components/timeline/container/index.tsx`:

```tsx
import { useEffect, useRef } from "react";
import TimelineGrid from "../axis/grid";
import { TimelineProvider, useTimelineController } from "../controller/context";
import TimeUnitsBar from "../header/time-units-bar";
import NowLine from "../now-line";
import { usePan } from "../use-pan";
import ZoomControl from "../zoom-control";

function TimelineCanvas() {
	const { setViewportWidth } = useTimelineController();
	const ref = useRef<HTMLDivElement>(null);
	const { onPointerDown, onWheel } = usePan();

	// Measure the viewport width and keep it in sync on resize.
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => setViewportWidth(el.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [setViewportWidth]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-end border-b border-border p-2">
				<ZoomControl />
			</div>
			<div
				ref={ref}
				className="relative flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
				onPointerDown={onPointerDown}
				onWheel={onWheel}
			>
				{/* header band */}
				<div className="absolute inset-x-0 top-0 h-12">
					<TimeUnitsBar />
				</div>
				{/* grid + now-line fill below the header */}
				<div className="absolute inset-x-0 bottom-0 top-12">
					<TimelineGrid />
					<NowLine />
				</div>
			</div>
		</div>
	);
}

export default function TimelineContainer() {
	return (
		<TimelineProvider>
			<TimelineCanvas />
		</TimelineProvider>
	);
}
```

- [ ] **Step 5: Delete the obsolete subheader stub**

Run:
```bash
cd /Users/thinhle/Documents/Development/orbit
git rm apps/web/src/components/timeline/subheader/index.tsx 2>/dev/null || rm -f apps/web/src/components/timeline/subheader/index.tsx
```
(The now-line replaces it. If the file was never committed, `rm -f` is sufficient.)

- [ ] **Step 6: Wire the route**

Replace the contents of `apps/web/src/routes/_workspace/$orgSlug/timeline.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import TimelineContainer from "#/components/timeline/container";

export const Route = createFileRoute("/_workspace/$orgSlug/timeline")({
	component: TimelinePage,
});

function TimelinePage() {
	return (
		<div className="h-full">
			<TimelineContainer />
		</div>
	);
}
```

- [ ] **Step 7: Run the container test**

Run: `cd apps/web && pnpm test src/components/timeline/container/index.test.tsx`
Expected: PASS.

Note: happy-dom provides `ResizeObserver`. If this test errors with `ResizeObserver is not defined`, add to the top of `apps/web/src/test-setup.ts`:
```ts
if (!globalThis.ResizeObserver) {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}
```
Then re-run.

- [ ] **Step 8: Run the full timeline test suite + typecheck**

Run: `cd apps/web && pnpm test src/components/timeline && pnpm typecheck`
Expected: all timeline tests PASS; no type errors.

- [ ] **Step 9: Lint/format**

Run: `cd /Users/thinhle/Documents/Development/orbit && pnpm check`
Expected: no errors. Fix any Biome findings (e.g. remove unused imports flagged in Tasks 4/5 notes).

- [ ] **Step 10: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit
git add apps/web/src/components/timeline apps/web/src/routes/_workspace/\$orgSlug/timeline.tsx
git commit -m "feat(timeline): assemble axis container with pan + zoom and wire route"
```

---

## Manual verification (after Task 8)

- [ ] Run `cd apps/web && pnpm dev`, open the workspace timeline route.
- [ ] Confirm: today line sits near center on load; the grid + two-row header are visible.
- [ ] Drag horizontally — the axis pans smoothly; trackpad/wheel pans too.
- [ ] Click each zoom button — granularity changes (days→weeks→quarters→quarters) and today re-centers.
- [ ] The first top-row label stays pinned at the left edge and slides out as the next approaches.
```
