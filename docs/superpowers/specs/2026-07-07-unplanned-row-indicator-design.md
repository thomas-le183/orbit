# Unplanned timeline row indicator

## Problem

Tasks with no start or end date are surfaced in the timeline as bar-less rows
(`undatedTaskRows`). The only current signal that a row is unplanned is a faint,
30%-opacity gray dot in the name column plus an em-dash in the date column.
Neither reads as "this task needs attention / needs scheduling." Users scanning
the timeline table cannot quickly spot which tasks are unplanned.

## Goal

Give each unplanned (undated) row a clear, unambiguous per-row indicator in the
timeline table's name column.

## Scope

- **In scope:** Replace the faint gray dot on undated rows in
  `apps/web/src/components/timeline/layout/timeline-table.tsx` with an amber
  `CalendarOff` icon (lucide-react) carrying a tooltip.
- **Out of scope:** The grid lane rendering (`items-layer.tsx`), the em-dash date
  cell, the click-to-schedule behavior, and the scheduler view. No data-model or
  API changes.

## Design

In the `undatedTaskRows.map(...)` block of `timeline-table.tsx`
([around line 159](../../../apps/web/src/components/timeline/layout/timeline-table.tsx#L159)):

- Swap `<span className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />`
  for a lucide **`CalendarOff`** icon.
  - Styling: `size-3.5 shrink-0 text-amber-500` (amber = attention, matches the
    "needs action" semantic; sized to sit inline with the row text).
  - Accessibility: `aria-label="Unplanned"` on the icon.
- Wrap the icon in the `@orbit/ui` `Tooltip` / `TooltipTrigger` /
  `TooltipContent` components with copy:
  **"Unplanned — set a start or due date to schedule."**
  - `TooltipTrigger` uses `render` / a plain wrapper so the icon stays inline and
    keeps its `aria-label`.
  - A `TooltipProvider` wraps the trigger (or reuse an ancestor provider if one
    already exists in the render tree).

The dated-row branch is unchanged and renders no such icon, so the amber
`CalendarOff` is a unique marker for unplanned rows.

## Testing

Extend `apps/web/src/components/timeline/layout/timeline-table.test.tsx`.
Following the `items-layer.test.tsx` pattern, mock `useTimelineData` (via
`vi.mock("../data/context")`) to inject:

- at least one dated item, and
- one `undatedTaskRows` entry.

Assertions:

1. The `Unplanned` indicator (queried by `aria-label="Unplanned"`) renders for
   the undated row.
2. It is **absent** for dated rows (count of `Unplanned` labels equals the number
   of undated rows).

## Acceptance criteria

- Undated rows show an amber `CalendarOff` icon with the tooltip copy above.
- Dated rows show no such icon.
- New test covers presence on undated rows and absence on dated rows.
- `pnpm check`, `pnpm typecheck`, and `apps/web` Vitest all pass.
