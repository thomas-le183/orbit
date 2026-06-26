# Infinite Calendar/Timeline Axis — Design Spec

- **Date:** 2026-06-26
- **App:** `apps/web` (`@orbit/web`)
- **Status:** Approved, pending implementation plan
- **Modeled on:** Jira Portfolio-3 roadmap timeline axis (virtual-controller architecture)

---

## 1. Goal & scope

Build a **content-agnostic infinite calendar axis** for the timeline page: it renders the
time grid, the two-row date header, and a "now" line, and exposes a controller that future
features can use to position content (bars, events) against the same time mapping.

**In scope (first cut):**
- Four zoom levels: `weeks | months | quarters | years`.
- Three visual layers: header (two rows), background gridlines, now-line.
- Interaction: horizontal drag-to-pan + wheel/trackpad pan; zoom via segmented buttons.
- A self-contained virtual scroll controller (React context + hooks), no external scroll dep.

**Out of scope (explicitly, YAGNI):**
- Any row/issue/event content on the timeline body.
- Virtualization library (`@tanstack/react-virtual`) — windowing falls out of the rendering
  window naturally; ~30–100 visible divs don't justify it.
- Fixed/custom-range (static) axis mode. Infinite mode only.
- Ctrl/Cmd-wheel pinch-zoom (buttons only for this cut).

---

## 2. Architecture

Mirror the Jira source's **virtual controller** model: **nothing scrolls natively in the DOM**.
A controller holds `{ offsetMs, zoomLevel, viewportWidth }`; every layer positions itself by
mapping a timestamp (expressed as **milliseconds relative to today**) to a **percentage** across
the viewport.

- **Origin** = today (`startOfUtcDay(Date.now())`). Unit offsets are signed ms from this origin.
- **All date math in UTC** via `date-fns` v4 (already a dependency).
- **Zoom** = a pixels-per-day scale per level. Changing zoom re-anchors on today.
- **Pan** updates `offsetMs`.

Difference from source: the source consumes a separate `@atlassian/jira-portfolio-3-horizontal-scrolling`
package. We build one self-contained controller exposing the same hook API surface, so there is
no external dependency.

---

## 3. Module structure

Under `apps/web/src/components/timeline/` (replaces the current stubs):

```
controller/
  context.tsx       TimelineProvider + useTimelineController (offsetMs, zoomLevel, viewportWidth)
  hooks.ts          useZoomLevel, useRenderingWindow, useHorizontalPercentageOffset
  geometry.ts       pure: msToPercent / percentToMs given { offsetMs, zoom, viewportWidth }
units/
  types.ts          Unit = { from, to, type }, ZoomLevel, RelativeTimeRangeOffset = { from, to }
  make-units.ts     makeUnits + getDayUnits/Week/Month/Quarter/Year + getUnits()   (port of source)
axis/
  grid.tsx          background gridlines (absolute divs; today column highlighted)
  unit.tsx          one gridline cell
header/
  time-units-bar.tsx   two rows (coarse top + fine bottom); per-zoom layouts
  label.tsx            top-label + bottom-cell renderers (incl. sticky-first-label trick)
now-line.tsx        today marker (2px vertical line + ▼ cap)
zoom-control.tsx    segmented Weeks/Months/Quarters/Years buttons (@orbit/ui)
container/index.tsx assembles provider + layers + interaction; replaces the stub
constants.ts        zoom px/day per level, fiscalMonth default
```

The existing `subheader/index.tsx` stub is repurposed (or removed) as the now-line layer lands;
`constants.ts` `SCROLL_PADDING` is no longer needed under the virtual model and will be removed.

---

## 4. Controller API (the contract all layers consume)

```ts
type ZoomLevel = 'weeks' | 'months' | 'quarters' | 'years';

// current zoom + setter; setting re-anchors the view on today
useZoomLevel(): [ZoomLevel, (z: ZoomLevel) => void];

// the visible time slice, ms relative to today, padded with a buffer so we
// only generate units we can see (true windowing)
useRenderingWindow(): { today: number; from: number; to: number };

// ms-offset-from-today -> left% across the viewport
useHorizontalPercentageOffset(): { getPercentageOffset: (ms: number) => number };
```

**Geometry (pure, in `geometry.ts`):**
- `zoom` resolves to **pixels-per-day** per level (e.g. weeks largest, years smallest).
- `msToPercent(ms, { offsetMs, zoom, viewportWidth })` = `((ms − offsetMs) / msPerViewport) * 100`,
  where `msPerViewport = viewportWidth / pxPerMs`.
- `percentToMs` is the inverse (used by pan/drag math).
- A unit's width% = `getPercentageOffset(unit.to) − getPercentageOffset(unit.from)`.

---

## 5. Unit engine (`units/make-units.ts`)

Direct port of the source `makeUnits(range, type, initialize, next)`:

```
makeUnits({from, to}, type, initialize, next):
  today = startOfUtcDay(Date.now())
  cursor = new Date(today + from); cursor.setUTCHours(0,0,0,0); cursor = initialize(cursor)
  while cursor < today + to:
    unitFrom = cursor - today
    cursor = next(cursor)
    unitTo = cursor - today
    push { from: unitFrom, to: unitTo, type }
```

Boundary rules (`initialize` / `next`), identical to source:

| Generator       | initialize (snap to)             | next (advance)        |
| --------------- | -------------------------------- | --------------------- |
| `getDayUnits`   | Monday of the week               | +1 day                |
| `getWeekUnits`  | Monday of the week               | +1 week               |
| `getMonthUnits` | 1st of the month                 | +1 month              |
| `getQuarterUnits` | quarter start (respects fiscalMonth) | +3 months         |
| `getYearUnits`  | fiscal-year start                | +1 year               |

`getUnits(range, zoomLevel, fiscalMonth = 1)` dispatches on `zoomLevel`.
`getTodayColumnIndex(units)` = index where `from <= 0 && to > 0` (today highlight).
`fiscalMonth` defaults to 1 (calendar year); kept as a prop for later financial-year support.

---

## 6. The three layers (per zoom level — same mapping as source)

| Zoom     | Header top | Header bottom         | Grid border    |
| -------- | ---------- | --------------------- | -------------- |
| weeks    | month      | days                  | every week (Mon) |
| months   | month      | weeks                 | end of month   |
| quarters | year       | quarters (Q1 Jan–Mar) | each quarter   |
| years    | year       | quarters (Q1)         | each year      |

- **Grid** (`axis/grid.tsx`): absolutely-positioned `<Unit>` divs (`left%` + `width%`), right
  border per the table above; the today column gets a subtle highlight background.
- **Header** (`header/time-units-bar.tsx`): two rows. Top = coarse unit, bottom = fine unit, both
  absolutely positioned. Implements the **sticky-first-label trick**: the first visible top label
  is pinned to the left edge; as the next label approaches, the first slides left out of the way
  (overlap threshold per zoom level). Bottom cells may carry tooltips later (not required cut-1).
- **Now-line** (`now-line.tsx`): `left% = getPercentageOffset(todayMs)`; a 2px vertical line with
  a small ▼ cap at top.

---

## 7. Interaction

- **Pan:** pointer drag (Pointer Events) and wheel/trackpad horizontal → update `offsetMs` via
  `percentToMs`/px math.
- **Zoom:** `<ZoomControl>` segmented buttons (`@orbit/ui`) set `zoomLevel`; the controller
  re-anchors today on change.
- **Styling:** Tailwind v4 utility classes; `cn()` from `@orbit/shared` for conditional classes;
  shadcn-style primitives from `@orbit/ui` where applicable.

---

## 8. Testing

Vitest (`apps/web`):
- `geometry.test.ts` — `msToPercent` / `percentToMs` round-trip; viewport/zoom scaling.
- `make-units.test.ts` — boundary snapping (Monday, 1st, quarter start, FY start), `+unit`
  advancement, fiscal-month shifts, `getTodayColumnIndex`.
- Container render smoke-test (mounts under provider, renders a header + grid + now-line).

The pure logic in `geometry.ts` and `make-units.ts` is where bugs hide and gets the most coverage.

---

## 9. Integration

- `container/index.tsx` wraps everything in `TimelineProvider`, measures viewport width, mounts
  `<ZoomControl>`, header, grid, and now-line, and wires pan handlers. It replaces the current
  `TimelineContainer` stub.
- The route `routes/_workspace/$orgSlug/timeline.tsx` renders `<TimelineContainer />` in place of
  the "Coming soon" placeholder.
```
