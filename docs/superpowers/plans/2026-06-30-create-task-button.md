# Create Task Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "New task" entry point to both the sidebar per-project row and the timeline toolbar, each independently opening the existing `CreateTaskDialog`.

**Architecture:** Three independent edits — (1) extract `ProjectNavItem` in the sidebar and add a hover-revealed `+` button with its own dialog state; (2) add an optional `onNewTask` callback prop to `SplitLayout` that renders a "New task" button in the toolbar; (3) wire `TimelineView` to own the dialog state and pass `onNewTask` down to `SplitLayout` when a `projectId` is active.

**Tech Stack:** React 19, `@tanstack/react-router`, `@orbit/ui` (Button, sidebar), `lucide-react` (PlusIcon), Vitest + Testing Library, Biome (tabs).

## Global Constraints

- Biome tabs — no spaces for indentation in `.tsx` files.
- No `any`.
- `cn()` from `@orbit/shared` if class merging is needed.
- `Button` from `@orbit/ui/components/button`; `PlusIcon` from `lucide-react`.
- `CreateTaskDialog` imported from `apps/web/src/components/timeline/create-task-dialog`.
- Seed mode (`projectId` undefined) must never show the "New task" toolbar button.
- `e.stopPropagation()` on the sidebar `+` click to prevent navigation.

---

### Task 1: Sidebar per-project create button

**Files:**
- Modify: `apps/web/src/components/workspace/projects-nav-section.tsx`
- Modify: `apps/web/src/components/workspace/projects-nav-section.test.tsx`

**Interfaces:**
- Consumes: `CreateTaskDialog({ projectId, open, onOpenChange })` from `../../components/timeline/create-task-dialog` (relative from workspace folder: `../timeline/create-task-dialog`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the `CreateTaskDialog` mock and a failing test**

Open `apps/web/src/components/workspace/projects-nav-section.test.tsx`. Add a mock for `CreateTaskDialog` and a new test after the existing three:

```tsx
// add after the existing vi.mock("./create-project-dialog", ...) call:
vi.mock("../timeline/create-task-dialog", () => ({
	CreateTaskDialog: ({
		open,
		projectId,
	}: {
		open: boolean;
		projectId: string;
	}) =>
		open ? <div data-testid="create-task-dialog">{projectId}</div> : null,
}));
```

Then add the test inside the `describe("ProjectsNavSection", ...)` block:

```tsx
it("opens the create-task dialog for a project row when the + button is clicked", () => {
	useProjectsMock.mockReturnValue({
		data: [{ id: "p1", name: "Alpha", color: null }],
		isLoading: false,
		isError: false,
	});
	renderWithSidebar(<ProjectsNavSection orgSlug="acme" />);
	expect(screen.queryByTestId("create-task-dialog")).toBeNull();
	fireEvent.click(
		screen.getByRole("button", { name: /new task in alpha/i }),
	);
	expect(screen.getByTestId("create-task-dialog")).toBeInTheDocument();
	expect(screen.getByTestId("create-task-dialog").textContent).toBe("p1");
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && pnpm test projects-nav-section.test.tsx
```

Expected: FAIL — `button` with name `/new task in alpha/i` not found.

- [ ] **Step 3: Implement `ProjectNavItem` and the `+` button**

Replace the contents of `apps/web/src/components/workspace/projects-nav-section.tsx` with:

```tsx
import { Button } from "@orbit/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@orbit/ui/components/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
} from "@orbit/ui/components/sidebar";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { type MouseEventHandler, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useProjects } from "@/hooks/use-projects";
import { CreateTaskDialog } from "../timeline/create-task-dialog";
import { CreateProjectDialog } from "./create-project-dialog";

type Project = { id: string; name: string; color: string | null };

function ProjectNavItem({
	project,
	orgSlug,
}: {
	project: Project;
	orgSlug: string;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={project.name}
				isActive={
					!!matchRoute({
						to: "/$orgSlug/projects/$projectId",
						params: { orgSlug, projectId: project.id },
					})
				}
				onClick={() =>
					navigate({
						to: "/$orgSlug/projects/$projectId",
						params: { orgSlug, projectId: project.id },
					})
				}
				className="group/item"
			>
				<span
					className="size-2 shrink-0 rounded-full"
					style={{
						backgroundColor:
							project.color ?? "var(--color-muted-foreground)",
					}}
				/>
				<span className="truncate">{project.name}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={`New task in ${project.name}`}
					className="ml-auto hidden group-hover/item:flex"
					onClick={(e) => {
						e.stopPropagation();
						setDialogOpen(true);
					}}
				>
					<PlusIcon />
				</Button>
			</SidebarMenuButton>
			<CreateTaskDialog
				projectId={project.id}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</SidebarMenuItem>
	);
}

export function ProjectsNavSection({ orgSlug }: { orgSlug: string }) {
	const { data: projects, isLoading, isError } = useProjects(orgSlug);
	const [open, setOpen] = useLocalStorage("sidebar:section:Projects", true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const navigate = useNavigate();

	const openDialog: MouseEventHandler = (e) => {
		e.stopPropagation();
		setDialogOpen(true);
	};

	return (
		<SidebarGroup>
			<Collapsible
				open={open}
				onOpenChange={setOpen}
				className="group/collapsible"
			>
				<CollapsibleTrigger
					render={
						<SidebarMenuButton
							tooltip="Projects"
							className="flex-1 group-data-[collapsible=icon]:hidden justify-between group/item"
						/>
					}
				>
					<SidebarGroupLabel>Projects</SidebarGroupLabel>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="New project"
							className="hidden group-hover/item:flex"
							onClick={openDialog}
						>
							<PlusIcon />
						</Button>
						<ChevronRightIcon className="ml-auto size-3.5 transition-transform ease-in-out group-data-open/collapsible:rotate-90" />
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent className="mt-0.5 overflow-hidden">
					<SidebarMenu>
						{isLoading &&
							[0, 1, 2].map((i) => (
								<SidebarMenuItem key={i}>
									<SidebarMenuSkeleton showIcon />
								</SidebarMenuItem>
							))}
						{isError && (
							<div className="px-2 py-1.5 text-xs text-muted-foreground">
								Couldn't load projects
							</div>
						)}
						{!isLoading && !isError && projects?.length === 0 && (
							<div className="px-2 py-1.5 text-xs text-muted-foreground">
								No projects yet
							</div>
						)}
						{projects?.map((project) => (
							<ProjectNavItem
								key={project.id}
								project={project}
								orgSlug={orgSlug}
							/>
						))}
					</SidebarMenu>
				</CollapsibleContent>
			</Collapsible>
			<CreateProjectDialog
				orgSlug={orgSlug}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</SidebarGroup>
	);
}
```

Note: the unused `useNavigate` import at the top level is removed — `ProjectNavItem` now owns navigation. Remove the `const navigate = useNavigate();` line from `ProjectsNavSection` since it is no longer used there (the `navigate` call moved into `ProjectNavItem`).

Actually keep `useNavigate` import because it's used inside `ProjectNavItem`. Remove the `const navigate = useNavigate()` line from `ProjectsNavSection` body (it no longer navigates itself). The code above already reflects this — `ProjectsNavSection` no longer calls `useNavigate`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test projects-nav-section.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Biome format**

```bash
pnpm check --write apps/web/src/components/workspace/projects-nav-section.tsx apps/web/src/components/workspace/projects-nav-section.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/workspace/projects-nav-section.tsx apps/web/src/components/workspace/projects-nav-section.test.tsx
git commit -m "feat(web): add per-project create-task button in sidebar"
```

---

### Task 2: SplitLayout `onNewTask` prop + toolbar button

**Files:**
- Modify: `apps/web/src/components/timeline/layout/split-layout.tsx`
- Modify: `apps/web/src/components/timeline/layout/split-layout.test.tsx`

**Interfaces:**
- Produces: `SplitLayoutProps.onNewTask?: () => void` — consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

Open `apps/web/src/components/timeline/layout/split-layout.test.tsx`. Read the full file first to understand the existing `renderShell` helper and the `MockResizeObserver` setup. Then add two tests inside or after the existing `describe` block (keep `renderShell` as-is):

```tsx
import { vi } from "vitest"; // add if not already imported
```

Add at the bottom of the file (after the existing tests):

```tsx
describe("SplitLayout toolbar: onNewTask", () => {
	it("renders a 'New task' button when onNewTask is provided", () => {
		const onNewTask = vi.fn();
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const { getByRole } = render(
			<QueryClientProvider client={client}>
				<TimelineDataProvider>
					<SplitLayout
						tableHeader={<TimelineTableHeader />}
						table={<TimelineTable />}
						onNewTask={onNewTask}
					/>
				</TimelineDataProvider>
			</QueryClientProvider>,
		);
		const btn = getByRole("button", { name: /new task/i });
		expect(btn).toBeInTheDocument();
		fireEvent.click(btn);
		expect(onNewTask).toHaveBeenCalledOnce();
	});

	it("does not render a 'New task' button when onNewTask is not provided", () => {
		const { queryByRole } = renderShell();
		expect(queryByRole("button", { name: /new task/i })).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/web && pnpm test split-layout.test.tsx
```

Expected: the two new tests FAIL — no button with name `/new task/i`.

- [ ] **Step 3: Add `onNewTask` prop and button to `SplitLayout`**

Open `apps/web/src/components/timeline/layout/split-layout.tsx`.

1. Add `Button` import (it isn't imported yet):

```tsx
import { Button } from "@orbit/ui/components/button";
```

2. Add `PlusIcon` to the existing `lucide-react` import:

```tsx
import { ChevronLeft, ChevronRight, PlusIcon } from "lucide-react";
```

3. Update `SplitLayoutProps` to add the optional prop:

```tsx
type SplitLayoutProps = {
	tableHeader: ReactNode;
	table: ReactNode;
	initialTableWidth?: number;
	onNewTask?: () => void;
};
```

4. Update `SplitLayoutInner` signature to accept `onNewTask`:

```tsx
function SplitLayoutInner({
	tableHeader,
	table,
	initialTableWidth,
	onNewTask,
}: SplitLayoutProps) {
```

5. In the toolbar `<div>`, add the "New task" button before the pan-earlier button:

Find this block:
```tsx
<div className="flex items-center gap-1.5">
    <button
        type="button"
        aria-label="Scroll to earlier dates"
```

Replace with:
```tsx
<div className="flex items-center gap-1.5">
    {onNewTask && (
        <Button variant="outline" size="sm" onClick={onNewTask}>
            <PlusIcon className="size-3.5" />
            New task
        </Button>
    )}
    <button
        type="button"
        aria-label="Scroll to earlier dates"
```

6. Thread `onNewTask` through in the outer `SplitLayout` wrapper:

Find:
```tsx
export default function SplitLayout(props: SplitLayoutProps) {
	const { data: prefs } = usePreferences();
	return (
		<TimelineProvider weekStart={prefs?.weekStart ?? 1}>
			<RowSelectionProvider>
				<SplitLayoutInner {...props} />
```

This already spreads `props` so `onNewTask` reaches `SplitLayoutInner` automatically. No change needed here.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test split-layout.test.tsx
```

Expected: all tests PASS (including the two new ones).

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Biome format**

```bash
pnpm check --write apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/layout/split-layout.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/layout/split-layout.test.tsx
git commit -m "feat(web): add onNewTask prop to SplitLayout toolbar"
```

---

### Task 3: Wire `TimelineView` — dialog state + `onNewTask`

**Files:**
- Modify: `apps/web/src/components/timeline/timeline-view.tsx`
- Modify: `apps/web/src/components/timeline/timeline-view.test.tsx`

**Interfaces:**
- Consumes: `SplitLayoutProps.onNewTask?: () => void` (Task 2); `CreateTaskDialog({ projectId, open, onOpenChange })` (existing).

- [ ] **Step 1: Update the `SplitLayout` mock and add failing tests**

Open `apps/web/src/components/timeline/timeline-view.test.tsx`.

1. Update the existing `SplitLayout` mock to expose `onNewTask`:

```tsx
vi.mock("./layout/split-layout", () => ({
	default: ({ onNewTask }: { onNewTask?: () => void }) => (
		<div>{onNewTask ? "split-layout-with-new-task" : "split-layout"}</div>
	),
}));
```

2. Add a mock for `CreateTaskDialog` (after the existing `vi.mock("./timeline-skeleton", ...)` line):

```tsx
vi.mock("./create-task-dialog", () => ({
	CreateTaskDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-task-dialog-open</div> : null,
}));
```

3. Add two tests inside the `describe("TimelineView", ...)` block:

```tsx
it("passes onNewTask to SplitLayout when a project has tasks", () => {
	dataMock.mockReturnValue(value({ projectId: "p1", items: [{ id: "t1" }] }));
	render(<TimelineView />);
	expect(
		screen.getByText("split-layout-with-new-task"),
	).toBeInTheDocument();
});

it("does not pass onNewTask to SplitLayout in seed mode", () => {
	dataMock.mockReturnValue(value({ projectId: undefined, items: [] }));
	render(<TimelineView />);
	expect(screen.getByText("split-layout")).toBeInTheDocument();
	expect(
		screen.queryByText("split-layout-with-new-task"),
	).toBeNull();
});
```

- [ ] **Step 2: Run to verify the new tests fail and existing tests still pass**

```bash
cd apps/web && pnpm test timeline-view.test.tsx
```

Expected: the two new tests FAIL (SplitLayout mock change makes the "shows the timeline when the project has tasks" test text mismatch too — update that existing assertion after implementing, but for now confirm the new tests are the ones failing).

Actually, the existing tests that assert `screen.getByText("split-layout")` will now break because the mock returns `"split-layout-with-new-task"` when `onNewTask` is passed and `"split-layout"` when not. The test "shows the timeline when the project has tasks" currently checks for `"split-layout"` but after implementation will get `"split-layout-with-new-task"`. Update that test assertion too:

```tsx
it("shows the timeline when the project has tasks", () => {
	dataMock.mockReturnValue(value({ projectId: "p1", items: [{ id: "t1" }] }));
	render(<TimelineView />);
	expect(
		screen.getByText("split-layout-with-new-task"),
	).toBeInTheDocument();
	expect(screen.queryByText("empty-state")).toBeNull();
});
```

- [ ] **Step 3: Implement dialog state + `onNewTask` in `TimelineView`**

Replace the contents of `apps/web/src/components/timeline/timeline-view.tsx` with:

```tsx
import { useState } from "react";
import { CreateTaskDialog } from "./create-task-dialog";
import { useTimelineData } from "./data/context";
import SplitLayout from "./layout/split-layout";
import TimelineTable, { TimelineTableHeader } from "./layout/timeline-table";
import TimelineEmptyState from "./timeline-empty-state";
import TimelineSkeleton from "./timeline-skeleton";

export default function TimelineView() {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();
	const [newTaskOpen, setNewTaskOpen] = useState(false);

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
				<>
					<SplitLayout
						tableHeader={<TimelineTableHeader />}
						table={<TimelineTable />}
						onNewTask={projectId ? () => setNewTaskOpen(true) : undefined}
					/>
					{projectId && (
						<CreateTaskDialog
							projectId={projectId}
							open={newTaskOpen}
							onOpenChange={setNewTaskOpen}
						/>
					)}
				</>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Run all `TimelineView` tests**

```bash
cd apps/web && pnpm test timeline-view.test.tsx
```

Expected: 6 tests PASS (4 existing + 2 new).

- [ ] **Step 5: Run full suite**

```bash
cd apps/web && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Biome format**

```bash
pnpm check --write apps/web/src/components/timeline/timeline-view.tsx apps/web/src/components/timeline/timeline-view.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/timeline/timeline-view.tsx apps/web/src/components/timeline/timeline-view.test.tsx
git commit -m "feat(web): wire TimelineView new-task dialog from toolbar"
```
