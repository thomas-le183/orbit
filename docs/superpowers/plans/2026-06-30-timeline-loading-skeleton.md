# Timeline Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a full skeleton screen in place of the project timeline while that project's tasks/milestones are loading, replacing the bare-grid flash with an intentional loading state.

**Architecture:** A new pure-presentational `TimelineSkeleton` component renders 7 static rows mirroring the split-layout geometry (left table column + right bar area shimmer). `TimelineView` gains a loading gate that takes precedence over the empty-state gate: `isLoadingProject → skeleton`, `isEmptyProject → empty state`, else timeline.

**Tech Stack:** React 19, Vitest + Testing Library, `Skeleton` from `@orbit/ui/components/skeleton`, `cn()` from `@orbit/shared`, Tailwind CSS v4, Biome (tabs).

## Global Constraints

- Use `Skeleton` from `@orbit/ui/components/skeleton` — do not write custom shimmer CSS.
- Use `cn()` from `@orbit/shared` for conditional class merging.
- Biome tabs (no spaces for indentation).
- No `any`.
- Row height must come from `ROW_HEIGHT` imported from `./layout/row-metrics` so skeleton rows match the real timeline rows exactly.
- Gate order in `TimelineView`: `isLoadingProject` checked first, then `isEmptyProject`, then timeline.

---

### Task 1: New `TimelineSkeleton` component + test

**Files:**
- Create: `apps/web/src/components/timeline/timeline-skeleton.tsx`
- Create: `apps/web/src/components/timeline/timeline-skeleton.test.tsx`

**Interfaces:**
- Produces: `default export function TimelineSkeleton()` — no props.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/timeline/timeline-skeleton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TimelineSkeleton from "./timeline-skeleton";

describe("TimelineSkeleton", () => {
	it("renders 7 skeleton rows", () => {
		const { container } = render(<TimelineSkeleton />);
		expect(
			container.querySelectorAll("[data-testid='timeline-skeleton-row']").length,
		).toBe(7);
	});

	it("marks the container aria-busy", () => {
		const { container } = render(<TimelineSkeleton />);
		expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
	});

	it("exposes a 'Loading tasks' accessible label", () => {
		render(<TimelineSkeleton />);
		expect(screen.getByText("Loading tasks")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && pnpm test timeline-skeleton.test.tsx
```

Expected: FAIL — `TimelineSkeleton` not found.

- [ ] **Step 3: Implement `TimelineSkeleton`**

Create `apps/web/src/components/timeline/timeline-skeleton.tsx`:

```tsx
import { cn } from "@orbit/shared";
import { Skeleton } from "@orbit/ui/components/skeleton";
import { ROW_HEIGHT } from "./layout/row-metrics";

const ROWS: Array<{ nameW: string; barOff: number; barW: number }> = [
	{ nameW: "w-36", barOff: 8, barW: 30 },
	{ nameW: "w-28", barOff: 24, barW: 45 },
	{ nameW: "w-40", barOff: 12, barW: 25 },
	{ nameW: "w-32", barOff: 38, barW: 35 },
	{ nameW: "w-24", barOff: 18, barW: 50 },
	{ nameW: "w-44", barOff: 5, barW: 28 },
	{ nameW: "w-36", barOff: 30, barW: 40 },
];

/** Full-view skeleton that mimics the split-layout while a project's data loads. */
export default function TimelineSkeleton() {
	return (
		<div className="h-full" aria-busy="true">
			<span className="sr-only">Loading tasks</span>
			<div className="flex h-full flex-col">
				{/* toolbar placeholder */}
				<div className="flex items-center gap-2 border-b border-border p-2">
					<Skeleton className="h-7 w-20 rounded-md" />
					<Skeleton className="h-7 w-14 rounded-md" />
					<Skeleton className="h-7 w-20 rounded-md" />
				</div>
				{/* header band placeholder */}
				<div className="flex h-12 shrink-0 items-center border-b border-border px-3">
					<Skeleton className="h-4 w-48 rounded" />
				</div>
				{/* rows */}
				<div className="flex-1 overflow-hidden">
					{ROWS.map((row, i) => (
						<div
							key={i}
							data-testid="timeline-skeleton-row"
							className="flex items-center border-b border-border/40"
							style={{ height: ROW_HEIGHT }}
						>
							{/* left: table column region (~220px) */}
							<div className="flex w-[220px] shrink-0 items-center gap-2 px-3">
								<Skeleton className="size-2.5 shrink-0 rounded-full" />
								<Skeleton className={cn("h-3.5 rounded", row.nameW)} />
							</div>
							{/* right: bar area */}
							<div className="relative flex-1">
								<Skeleton
									className="absolute h-5 rounded-md"
									style={{
										left: `${row.barOff}%`,
										width: `${row.barW}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test timeline-skeleton.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/timeline/timeline-skeleton.tsx apps/web/src/components/timeline/timeline-skeleton.test.tsx
git commit -m "feat(web): add TimelineSkeleton component"
```

---

### Task 2: Update `TimelineView` gate + update the loading test case

**Files:**
- Modify: `apps/web/src/components/timeline/timeline-view.tsx`
- Modify: `apps/web/src/components/timeline/timeline-view.test.tsx`

**Interfaces:**
- Consumes: `default export function TimelineSkeleton()` from `./timeline-skeleton` (Task 1).

- [ ] **Step 1: Update the "while loading" test case and add skeleton mock**

Open `apps/web/src/components/timeline/timeline-view.test.tsx`. Make these two changes:

1. Add the skeleton mock alongside the existing mocks (after the `split-layout` mock):

```tsx
vi.mock("./timeline-skeleton", () => ({
	default: () => <div>skeleton</div>,
}));
```

2. Replace the existing "shows the timeline while loading" test:

```tsx
it("shows the skeleton while a project is loading", () => {
	dataMock.mockReturnValue(
		value({ projectId: "p1", items: [], isLoading: true }),
	);
	render(<TimelineView />);
	expect(screen.getByText("skeleton")).toBeInTheDocument();
	expect(screen.queryByText("split-layout")).toBeNull();
	expect(screen.queryByText("empty-state")).toBeNull();
});
```

Full updated file for reference:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineData } from "./data/context";
import TimelineView from "./timeline-view";

vi.mock("./data/context", () => ({ useTimelineData: vi.fn() }));
vi.mock("./timeline-empty-state", () => ({
	default: () => <div>empty-state</div>,
}));
vi.mock("./layout/split-layout", () => ({
	default: () => <div>split-layout</div>,
}));
vi.mock("./layout/timeline-table", () => ({
	default: () => null,
	TimelineTableHeader: () => null,
}));
vi.mock("./timeline-skeleton", () => ({
	default: () => <div>skeleton</div>,
}));

const dataMock = useTimelineData as unknown as ReturnType<typeof vi.fn>;

function value(overrides: Record<string, unknown>) {
	return {
		items: [],
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		undatedTaskRows: [],
		milestoneMarkers: [],
		isLoading: false,
		isError: false,
		projectId: undefined,
		...overrides,
	};
}

describe("TimelineView", () => {
	beforeEach(() => vi.clearAllMocks());

	it("shows the empty state for a project with zero tasks", () => {
		dataMock.mockReturnValue(
			value({ projectId: "p1", items: [], undatedTaskRows: [] }),
		);
		render(<TimelineView />);
		expect(screen.getByText("empty-state")).toBeInTheDocument();
		expect(screen.queryByText("split-layout")).toBeNull();
	});

	it("shows the timeline when the project has tasks", () => {
		dataMock.mockReturnValue(value({ projectId: "p1", items: [{ id: "t1" }] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
		expect(screen.queryByText("empty-state")).toBeNull();
	});

	it("shows the timeline in seed mode (no projectId) even with zero items", () => {
		dataMock.mockReturnValue(value({ projectId: undefined, items: [] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
	});

	it("shows the skeleton while a project is loading", () => {
		dataMock.mockReturnValue(
			value({ projectId: "p1", items: [], isLoading: true }),
		);
		render(<TimelineView />);
		expect(screen.getByText("skeleton")).toBeInTheDocument();
		expect(screen.queryByText("split-layout")).toBeNull();
		expect(screen.queryByText("empty-state")).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify the loading test now fails (skeleton not imported yet)**

```bash
cd apps/web && pnpm test timeline-view.test.tsx
```

Expected: "shows the skeleton while a project is loading" FAIL — `TimelineView` still renders `split-layout` during loading.

- [ ] **Step 3: Update `TimelineView` to add the loading gate**

Replace the contents of `apps/web/src/components/timeline/timeline-view.tsx`:

```tsx
import { useTimelineData } from "./data/context";
import SplitLayout from "./layout/split-layout";
import TimelineTable, { TimelineTableHeader } from "./layout/timeline-table";
import TimelineEmptyState from "./timeline-empty-state";
import TimelineSkeleton from "./timeline-skeleton";

export default function TimelineView() {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();
	const isLoadingProject = !!projectId && isLoading;
	const isEmptyProject =
		!!projectId &&
		!isLoading &&
		!isError &&
		items.length === 0 &&
		undatedTaskRows.length === 0;

	return (
		<div className="h-full">
			{isLoadingProject ? (
				<TimelineSkeleton />
			) : isEmptyProject ? (
				<TimelineEmptyState projectId={projectId} />
			) : (
				<SplitLayout
					tableHeader={<TimelineTableHeader />}
					table={<TimelineTable />}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Run all `TimelineView` tests to verify all 4 pass**

```bash
cd apps/web && pnpm test timeline-view.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd apps/web && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/timeline-view.tsx apps/web/src/components/timeline/timeline-view.test.tsx
git commit -m "feat(web): show TimelineSkeleton while project tasks load"
```
