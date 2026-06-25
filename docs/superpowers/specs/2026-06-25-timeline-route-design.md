# Timeline Route Design

**Date:** 2026-06-25

## Summary

Add a `/timeline` placeholder page to the Overview section of the Home sidebar.

## Changes

### 1. New route file
`apps/web/src/routes/_workspace/$orgSlug/timeline.tsx`

Follows the same stub pattern as `activity.tsx` — centered heading "Timeline" + "Coming soon." text. No data fetching, no state.

### 2. Navigation config
`apps/web/src/config/navigation.ts`

- Import `GanttChartIcon` from lucide-react
- Add a `Timeline` entry to the Overview section of `getHomeConfig`, after Activity
- Add `"timeline"` to the `resolveModule` switch so the Home sidebar stays active when on that route
