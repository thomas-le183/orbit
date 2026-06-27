# Timeline Chart — How Positions Are Calculated

This explains the math behind the timeline/calendar axis: how a date becomes an
`x` position, how the visible time window is derived, how units (days/weeks/
quarters…) are generated, and how every layer (header, grid, now-line, task bars,
scrollbar) reuses that one mapping so everything lines up.

Code lives in `apps/web/src/components/timeline/`.

---

## 1. The core idea: a virtual controller, not a scroll container

Nothing scrolls natively in the DOM. Instead a **controller** holds three numbers,
and every layer computes its own pixel positions from them:

| State (`controller/context.tsx`) | Meaning |
| --- | --- |
| `today` | `startOfUtcDay(Date.now())` — the **origin** (ms epoch). All positions are measured relative to this. |
| `offsetMs` | The ms-offset-from-today sitting at the **left edge** (0%) of the viewport. Panning changes this. |
| `viewportWidth` | The measured pixel width of the timeline canvas (from `useResizeObserver`). |
| `zoomLevel` | `weeks \| months \| quarters \| years`. |
| `weekStart` | `0=Sun … 6=Sat` (user preference). |

**Key convention:** time is always expressed as **milliseconds relative to `today`**.
`today` itself is `0`. Yesterday is `-86_400_000`. A unit/task carries `{ from, to }`
as these signed ms-offsets. Absolute date = `today + offset`. All date math is UTC.

---

## 2. The scale: pixels per day → pixels per millisecond

Each zoom level defines how wide one calendar day is, in CSS pixels
(`controller/geometry.ts`):

```ts
PX_PER_DAY = { weeks: 32, months: 8, quarters: 2.4, years: 0.8 }
pxPerMs(zoom) = PX_PER_DAY[zoom] / 86_400_000      // px per millisecond
```

From that, the viewport's time span:

```ts
msPerViewport = viewportWidth / pxPerMs(zoom)       // how many ms fit on screen
```

Example: in `weeks` zoom (32 px/day) an 800 px viewport shows
`800 / 32 = 25` days.

---

## 3. The one mapping everything uses: `ms → %`

A timestamp (as ms-offset-from-today) becomes a horizontal percentage across the
viewport:

```ts
msToPercent(ms) = ((ms - offsetMs) / msPerViewport) * 100
percentToMs(p)  = (p / 100) * msPerViewport + offsetMs    // inverse
```

- `ms === offsetMs` → `0%` (left edge).
- `ms === offsetMs + msPerViewport` → `100%` (right edge).

This is exposed as `useHorizontalPercentageOffset().getPercentageOffset(ms)`.
**Every layer positions itself with this function**, which is why the header,
gridlines, now-line and task bars always agree.

A span `[from, to]` becomes:

```
left%  = getPercentageOffset(from)
width% = getPercentageOffset(to) - getPercentageOffset(from)
```

---

## 4. The rendering window (virtualization)

We only build the units/bars that can be seen. `useRenderingWindow()` returns the
visible slice padded by one screen on each side (`RENDER_BUFFER_SCREENS = 1`):

```ts
span   = msPerViewport
from   = offsetMs - span        // one screen of buffer to the left
to     = offsetMs + span + span // visible screen + one screen buffer right
```

Generators receive `{ from, to }` and emit only units inside it. As you pan,
`offsetMs` changes, the window slides, and the set of rendered units is recomputed.

---

## 5. Generating time units (`units/make-units.ts`)

A "unit" is one column of the axis: `{ from, to, type }` in ms-offsets. The engine
walks a UTC date cursor across the window, snapping to boundaries:

```ts
makeUnits({from, to}, type, today, initialize, next):
  cursor = startOfUtcDay(today + from)
  cursor = initialize(cursor)            // snap back to the unit boundary
  while cursor < today + to:
    unitFrom = cursor - today
    cursor   = next(cursor)              // advance one unit
    unitTo   = cursor - today
    push { from: unitFrom, to: unitTo, type }
```

Boundary rules (`initialize` / `next`):

| Generator | snap to | advance |
| --- | --- | --- |
| `getDayUnits` | week start (`toWeekStart`) | +1 day |
| `getWeekUnits` | week start | +1 week |
| `getMonthUnits` | 1st of month | +1 month |
| `getQuarterUnits` | quarter start (respects `fiscalMonth`) | +3 months |
| `getYearUnits` | (fiscal) year start | +1 year |

**Week start** is configurable: `toWeekStart(date, weekStart)` subtracts
`(getUTCDay() - weekStart + 7) % 7` days. `weekStart = 1` → snaps to Monday,
`0` → Sunday. It flows from the user preference via `useWeekStart()`.

`getUnits(range, zoomLevel, today, fiscalMonth, weekStart)` dispatches to the right
generator. `getTodayColumnIndex(units)` finds the column straddling today
(`from <= 0 && to > 0`) so it can be highlighted.

---

## 6. How each layer uses the mapping

**Header** (`header/time-units-bar.tsx`) — two rows. Top = coarse unit (month/year),
bottom = fine unit (day/week/quarter), per zoom. Each cell is positioned with
`getPercentageOffset`. The first top label is "sticky": `stickyLeftPx` pins it to the
left edge while its unit has room, then slides it left so it never escapes its unit:

```ts
stickyLeftPx(naturalLeftPx, unitRightPx, labelWidthPx) =
  min( max(0, naturalLeftPx), unitRightPx - labelWidthPx )
```

**Grid** (`axis/grid.tsx`) — one absolutely-positioned div per unit
(`left%` + `width%`), border depending on zoom (every day in weeks, end-of-month in
months, etc.), today's column highlighted via `getTodayColumnIndex`.

**Now-line** (`now-line.tsx`) — today is the origin, so its position is simply
`getPercentageOffset(0)`.

**Task bars** (`task-bars.tsx`) — each task's dates become a range:

```ts
from = startOfUtcDay(startDate) - today
to   = startOfUtcDay(endDate)   - today + ONE_DAY   // end date inclusive
```

Then `left% / width%` come from the same `getPercentageOffset`. Vertically each task
gets a fixed `ROW_HEIGHT` row. Progress fill is just a `task.progress %`-wide overlay.
If a task is off-screen, `rangeVisibility(from, to, geom)` returns `"left"`/`"right"`
and a clickable fly-out chip is shown instead; clicking it calls
`scrollToMs(centerMs)` to pan the task into view.

**Scrollbar** (`scrollbar.tsx`) — a synthetic thumb. It builds a **content bound**
(1 year before today → 2 years after, expanded to include the viewport), then:

```ts
scale      = viewportWidth / contentBoundWidthPx
thumbWidth = viewportWidth * min(scale, 1) - 7
thumbLeft  = msToPx(offsetMs - contentBound.offset) * scale     // msToPx = ms * pxPerMs
```

Dragging the thumb maps thumb travel back to `offsetMs`; clicking the track steps
25% of a viewport toward the click.

---

## 7. Panning and zooming

**Pan** (`use-pan.ts`): pointer-drag and wheel convert pixel movement to time using
`msPerPx = 1 / pxPerMs(zoom)` and adjust `offsetMs`. Dragging right reveals earlier
time, so `offsetMs` decreases.

**Zoom** (`zoom-control.tsx`): changing `zoomLevel` re-anchors the view on today via
`centeredOffset`, which uses `offsetToCenter(0)`:

```ts
offsetToCenter(ms) = ms - msPerViewport / 2     // puts `ms` at horizontal center
```

`scrollToToday()` = center on `0`; `scrollToMs(ms)` = center on any offset (used by
the task fly-out and the "Today" button).

---

## 8. Worked example

Zoom `weeks` (32 px/day), `viewportWidth = 800`, `offsetMs = -7 days`,
a task on **today**:

- `msPerViewport = 800 / (32/86_400_000) = 25 days`.
- Task range ≈ `{ from: 0, to: +1 day }`.
- `left% = ((0 - (-7d)) / 25d) * 100 = 28%`.
- `right% = ((1d - (-7d)) / 25d) * 100 = 32%`.
- Bar sits at `left: 28%`, `width: 4%`. The now-line sits at the same `28%`.

Everything that needs to point at "today" computes `getPercentageOffset(0)` and lands
on the same pixel — that is the whole trick.
