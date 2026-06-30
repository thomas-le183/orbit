# Timeline Empty State + Full-Height Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a project has no tasks, replace the timeline with a centered empty-state screen offering a "Create task" action (create-task dialog → `POST /projects/:id/tasks`); when tasks exist, the left table column fills the full visible height instead of collapsing.

**Architecture:** Add a `useCreateTask(projectId)` mutation; expose `projectId` on the timeline data context; build a `CreateTaskDialog` and a `TimelineEmptyState`; gate `TimelineView` to render the empty state when a project has zero tasks; make the split-layout table column `min-h-full`.

**Tech Stack:** React 19, TanStack Query, `@tanstack/react-form`, `@orbit/ui`, Vitest + Testing Library (happy-dom).

**Spec:** `docs/superpowers/specs/2026-06-30-timeline-empty-state-design.md`

## Global Constraints

- Run from `apps/web`: `pnpm test` (vitest), `pnpm typecheck` (tsc). `pnpm check` (biome) from repo root.
- Server state via TanStack Query; HTTP via axios `api` from `@/lib/api`. Forms via `@tanstack/react-form` only. UI from `@orbit/ui`; `cn()` from `@orbit/shared`.
- Biome **tabs**. No `any`. Extensionless relative imports.
- Mutations mirror `hooks/use-projects.ts` `useCreateProject` (invalidate + toast, `getErrorMessage(err, fallback)` takes a REQUIRED fallback string). Dialog mirrors `components/workspace/create-project-dialog.tsx`.
- Create dialog sends **name + optional start/end dates only** (omit empty date strings).

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/hooks/use-tasks.ts` | (modify) add `useCreateTask(projectId)` |
| `apps/web/src/hooks/use-tasks.test.tsx` | (modify) add create-task tests |
| `apps/web/src/components/timeline/data/context.tsx` | (modify) expose `projectId` on the value |
| `apps/web/src/components/timeline/data/context.test.tsx` | (modify) assert `projectId` exposure |
| `apps/web/src/components/timeline/create-task-dialog.tsx` | (new) create-task dialog |
| `apps/web/src/components/timeline/create-task-dialog.test.tsx` | (new) dialog tests |
| `apps/web/src/components/timeline/timeline-empty-state.tsx` | (new) empty-state screen |
| `apps/web/src/components/timeline/timeline-empty-state.test.tsx` | (new) empty-state tests |
| `apps/web/src/components/timeline/timeline-view.tsx` | (modify) gate empty state vs timeline |
| `apps/web/src/components/timeline/timeline-view.test.tsx` | (new) gate tests |
| `apps/web/src/components/timeline/layout/split-layout.tsx` | (modify) `min-h-full` table column |
| `apps/web/src/components/timeline/items-layer.tsx` | (modify) remove dead empty overlay |
| `apps/web/src/components/timeline/items-layer.test.tsx` | (modify) drop empty-overlay cases |

---

### Task 1: `useCreateTask` mutation (TDD)

**Files:**
- Modify: `apps/web/src/hooks/use-tasks.ts`
- Modify: `apps/web/src/hooks/use-tasks.test.tsx`

**Interfaces:**
- Consumes: `Task`, `taskKeys` (already in `use-tasks.ts`); `CreateTaskInput` from `@orbit/shared`.
- Produces: `useCreateTask(projectId: string)` → mutation accepting `CreateTaskInput`, returning `Task`.

- [ ] **Step 1: Add the failing test to `apps/web/src/hooks/use-tasks.test.tsx`**

First, update the `api` mock at the top of the file from `{ get: vi.fn() }` to include `post`, and mock sonner. Change:

```tsx
vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
```
to:
```tsx
vi.mock("@/lib/api", () => ({
	api: { get: vi.fn(), post: vi.fn() },
	getErrorMessage: () => "error",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
```

Then add this describe block at the end of the file (and add `useCreateTask` to the import from `./use-tasks`, and `taskKeys`):

```tsx
describe("useCreateTask", () => {
	beforeEach(() => vi.clearAllMocks());

	it("posts to the project tasks endpoint and invalidates the list", async () => {
		(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { id: "t9", name: "New" },
		});
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = vi.spyOn(qc, "invalidateQueries");
		const Wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={qc}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useCreateTask("proj1"), {
			wrapper: Wrapper,
		});
		await result.current.mutateAsync({ name: "New" });
		expect(api.post).toHaveBeenCalledWith("/projects/proj1/tasks", {
			name: "New",
		});
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: taskKeys.list("proj1"),
		});
	});
});
```

(Ensure the import line reads `import { milestoneKeys, taskKeys, useCreateTask, useProjectMilestones, useProjectTasks } from "./use-tasks";` — add only the names not already imported.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- use-tasks`
Expected: FAIL — `useCreateTask` is not exported.

- [ ] **Step 3: Implement `useCreateTask` in `apps/web/src/hooks/use-tasks.ts`**

Update the imports at the top:

```ts
import type { CreateTaskInput } from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
```

Append this function at the end of the file:

```ts
export function useCreateTask(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateTaskInput) => {
			const { data } = await api.post<Task>(
				`/projects/${projectId}/tasks`,
				input,
			);
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: taskKeys.list(projectId) });
			toast.success("Task created");
		},
		onError: (err) => {
			toast.error(getErrorMessage(err, "Couldn't create task"));
		},
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- use-tasks`
Expected: PASS (existing query tests + the new create test).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm check apps/web/src/hooks/use-tasks.ts apps/web/src/hooks/use-tasks.test.tsx
git add apps/web/src/hooks/use-tasks.ts apps/web/src/hooks/use-tasks.test.tsx
git commit -m "feat(web): add useCreateTask mutation"
```

---

### Task 2: Expose `projectId` on the timeline data context (TDD)

**Files:**
- Modify: `apps/web/src/components/timeline/data/context.tsx`
- Modify: `apps/web/src/components/timeline/data/context.test.tsx`

**Interfaces:**
- Produces: `useTimelineData()` value gains `projectId: string | undefined`.

- [ ] **Step 1: Add the failing test to `apps/web/src/components/timeline/data/context.test.tsx`**

Add inside the existing `describe("TimelineDataProvider", ...)`:

```tsx
	it("exposes the projectId in project mode and undefined in seed mode", () => {
		const project = renderHook(() => useTimelineData(), { wrapper: wrapper("p") });
		expect(project.result.current.projectId).toBe("p");
		const seed = renderHook(() => useTimelineData(), { wrapper: wrapper() });
		expect(seed.result.current.projectId).toBeUndefined();
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- "data/context"`
Expected: FAIL — `projectId` is `undefined` in project mode (not yet on the value) / property missing.

- [ ] **Step 3: Add `projectId` to the value in `apps/web/src/components/timeline/data/context.tsx`**

In the `TimelineDataValue` type, add the field:

```ts
type TimelineDataValue = {
	items: TimelineItem[];
	updateItem: (id: string, patch: Partial<TimelineItem>) => void;
	moveDays: (id: string, days: number) => void;
	undatedTaskRows: UndatedTaskRow[];
	milestoneMarkers: MilestoneMarker[];
	isLoading: boolean;
	isError: boolean;
	projectId: string | undefined;
};
```

In the `useMemo` that builds `value`, add `projectId` to both the object and the dependency array:

```ts
	const value = useMemo<TimelineDataValue>(
		() => ({
			items,
			updateItem,
			moveDays,
			undatedTaskRows: mapped.undatedTaskRows,
			milestoneMarkers: mapped.milestoneMarkers,
			isLoading: projectId
				? tasksQuery.isLoading || milestonesQuery.isLoading
				: false,
			isError: projectId
				? tasksQuery.isError || milestonesQuery.isError
				: false,
			projectId,
		}),
		[
			items,
			updateItem,
			moveDays,
			mapped.undatedTaskRows,
			mapped.milestoneMarkers,
			projectId,
			tasksQuery.isLoading,
			tasksQuery.isError,
			milestonesQuery.isLoading,
			milestonesQuery.isError,
		],
	);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- "data/context"`
Expected: PASS (existing + new projectId test).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm check apps/web/src/components/timeline/data/context.tsx apps/web/src/components/timeline/data/context.test.tsx
git add apps/web/src/components/timeline/data/context.tsx apps/web/src/components/timeline/data/context.test.tsx
git commit -m "feat(web): expose projectId on timeline data context"
```

---

### Task 3: `CreateTaskDialog` (TDD)

**Files:**
- Create: `apps/web/src/components/timeline/create-task-dialog.tsx`
- Create: `apps/web/src/components/timeline/create-task-dialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateTask(projectId)` (Task 1).
- Produces: `CreateTaskDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (open: boolean) => void })`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/timeline/create-task-dialog.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTaskDialog } from "./create-task-dialog";

const mutateAsync = vi.fn();
vi.mock("@/hooks/use-tasks", () => ({
	useCreateTask: () => ({ mutateAsync, isPending: false }),
}));

describe("CreateTaskDialog", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue({ id: "t1", name: "Alpha" });
	});

	it("blocks submit and shows an error when the name is empty", async () => {
		render(
			<CreateTaskDialog projectId="p1" open onOpenChange={() => {}} />,
		);
		fireEvent.blur(screen.getByLabelText(/name/i));
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		await waitFor(() =>
			expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
		);
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("submits name only (no dates) and closes on success", async () => {
		const onOpenChange = vi.fn();
		render(
			<CreateTaskDialog projectId="p1" open onOpenChange={onOpenChange} />,
		);
		fireEvent.change(screen.getByLabelText(/name/i), {
			target: { value: "Beta" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({ name: "Beta" }),
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("includes dates when provided", async () => {
		render(
			<CreateTaskDialog projectId="p1" open onOpenChange={() => {}} />,
		);
		fireEvent.change(screen.getByLabelText(/name/i), {
			target: { value: "Gamma" },
		});
		fireEvent.change(screen.getByLabelText(/start/i), {
			target: { value: "2026-07-01" },
		});
		fireEvent.change(screen.getByLabelText(/end/i), {
			target: { value: "2026-07-05" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({
				name: "Gamma",
				startDate: "2026-07-01",
				endDate: "2026-07-05",
			}),
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- create-task-dialog`
Expected: FAIL — cannot resolve `./create-task-dialog`.

- [ ] **Step 3: Implement `apps/web/src/components/timeline/create-task-dialog.tsx`**

```tsx
import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@orbit/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useCreateTask } from "@/hooks/use-tasks";

export function CreateTaskDialog({
	projectId,
	open,
	onOpenChange,
}: {
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const create = useCreateTask(projectId);

	const form = useForm({
		defaultValues: { name: "", startDate: "", endDate: "" },
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			await create.mutateAsync({
				name,
				...(value.startDate ? { startDate: value.startDate } : {}),
				...(value.endDate ? { endDate: value.endDate } : {}),
			});
			onOpenChange(false);
			form.reset();
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>Create task</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					<form.Field
						name="name"
						validators={{
							onChange: ({ value }: { value: string }) =>
								value.trim().length === 0 ? "Name is required" : undefined,
							onBlur: ({ value }: { value: string }) =>
								value.trim().length === 0 ? "Name is required" : undefined,
						}}
					>
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Name</FieldLabel>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="Design review"
									/>
									{isInvalid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							);
						}}
					</form.Field>

					<div className="flex gap-3">
						<form.Field name="startDate">
							{(field) => (
								<Field className="flex-1">
									<FieldLabel htmlFor={field.name}>Start date</FieldLabel>
									<Input
										id={field.name}
										type="date"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</Field>
							)}
						</form.Field>
						<form.Field name="endDate">
							{(field) => (
								<Field className="flex-1">
									<FieldLabel htmlFor={field.name}>End date</FieldLabel>
									<Input
										id={field.name}
										type="date"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</Field>
							)}
						</form.Field>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={create.isPending}>
							Create task
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- create-task-dialog`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm check apps/web/src/components/timeline/create-task-dialog.tsx apps/web/src/components/timeline/create-task-dialog.test.tsx
git add apps/web/src/components/timeline/create-task-dialog.tsx apps/web/src/components/timeline/create-task-dialog.test.tsx
git commit -m "feat(web): add CreateTaskDialog"
```

---

### Task 4: `TimelineEmptyState` (TDD)

**Files:**
- Create: `apps/web/src/components/timeline/timeline-empty-state.tsx`
- Create: `apps/web/src/components/timeline/timeline-empty-state.test.tsx`

**Interfaces:**
- Consumes: `CreateTaskDialog` (Task 3).
- Produces: default export `TimelineEmptyState({ projectId }: { projectId: string })`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/timeline/timeline-empty-state.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TimelineEmptyState from "./timeline-empty-state";

vi.mock("./create-task-dialog", () => ({
	CreateTaskDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-task-dialog-open</div> : null,
}));

describe("TimelineEmptyState", () => {
	it("renders the empty heading and a create-task button", () => {
		render(<TimelineEmptyState projectId="p1" />);
		expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /create task/i }),
		).toBeInTheDocument();
	});

	it("opens the create-task dialog when the button is clicked", () => {
		render(<TimelineEmptyState projectId="p1" />);
		expect(screen.queryByText("create-task-dialog-open")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		expect(screen.getByText("create-task-dialog-open")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- timeline-empty-state`
Expected: FAIL — cannot resolve `./timeline-empty-state`.

- [ ] **Step 3: Implement `apps/web/src/components/timeline/timeline-empty-state.tsx`**

```tsx
import { Button } from "@orbit/ui/components/button";
import { ListTodoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "./create-task-dialog";

export default function TimelineEmptyState({
	projectId,
}: {
	projectId: string;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
			<ListTodoIcon className="size-10 text-muted-foreground" />
			<div className="space-y-1">
				<p className="text-sm font-medium text-foreground">No tasks yet</p>
				<p className="text-sm text-muted-foreground">
					Create your first task to start planning.
				</p>
			</div>
			<Button onClick={() => setDialogOpen(true)} className="gap-1.5">
				<PlusIcon className="size-4" />
				Create task
			</Button>
			<CreateTaskDialog
				projectId={projectId}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- timeline-empty-state`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm check apps/web/src/components/timeline/timeline-empty-state.tsx apps/web/src/components/timeline/timeline-empty-state.test.tsx
git add apps/web/src/components/timeline/timeline-empty-state.tsx apps/web/src/components/timeline/timeline-empty-state.test.tsx
git commit -m "feat(web): add TimelineEmptyState"
```

---

### Task 5: Gate `TimelineView` to the empty state (TDD)

**Files:**
- Modify: `apps/web/src/components/timeline/timeline-view.tsx`
- Create: `apps/web/src/components/timeline/timeline-view.test.tsx`

**Interfaces:**
- Consumes: `useTimelineData()` (now exposes `projectId`, Task 2); `TimelineEmptyState` (Task 4).

- [ ] **Step 1: Write the failing test `apps/web/src/components/timeline/timeline-view.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineData } from "./data/context";
import TimelineView from "./timeline-view";

vi.mock("./data/context", () => ({ useTimelineData: vi.fn() }));
vi.mock("./timeline-empty-state", () => ({
	default: () => <div>empty-state</div>,
}));
vi.mock("./layout/split-layout", () => ({ default: () => <div>split-layout</div> }));
vi.mock("./layout/timeline-table", () => ({
	default: () => null,
	TimelineTableHeader: () => null,
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
		dataMock.mockReturnValue(value({ projectId: "p1", items: [], undatedTaskRows: [] }));
		render(<TimelineView />);
		expect(screen.getByText("empty-state")).toBeInTheDocument();
		expect(screen.queryByText("split-layout")).toBeNull();
	});

	it("shows the timeline when the project has tasks", () => {
		dataMock.mockReturnValue(
			value({ projectId: "p1", items: [{ id: "t1" }] }),
		);
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
		expect(screen.queryByText("empty-state")).toBeNull();
	});

	it("shows the timeline in seed mode (no projectId) even with zero items", () => {
		dataMock.mockReturnValue(value({ projectId: undefined, items: [] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
	});

	it("shows the timeline while loading (no empty flash)", () => {
		dataMock.mockReturnValue(
			value({ projectId: "p1", items: [], isLoading: true }),
		);
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- timeline-view`
Expected: FAIL — `TimelineView` does not import `useTimelineData`/`TimelineEmptyState` yet (renders split-layout unconditionally; empty-state case fails).

- [ ] **Step 3: Implement the gate in `apps/web/src/components/timeline/timeline-view.tsx`**

Replace the file with:

```tsx
import { useTimelineData } from "./data/context";
import SplitLayout from "./layout/split-layout";
import TimelineTable, {
	TimelineTableHeader,
} from "./layout/timeline-table";
import TimelineEmptyState from "./timeline-empty-state";

export default function TimelineView() {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();
	const isEmptyProject =
		!!projectId &&
		!isLoading &&
		!isError &&
		items.length === 0 &&
		undatedTaskRows.length === 0;

	return (
		<div className="h-full">
			{isEmptyProject ? (
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- timeline-view`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/thinhle/Documents/Development/orbit && pnpm check apps/web/src/components/timeline/timeline-view.tsx apps/web/src/components/timeline/timeline-view.test.tsx
git add apps/web/src/components/timeline/timeline-view.tsx apps/web/src/components/timeline/timeline-view.test.tsx
git commit -m "feat(web): render empty state for projects with no tasks"
```

---

### Task 6: Full-height table column + remove dead empty overlay + verify

**Files:**
- Modify: `apps/web/src/components/timeline/layout/split-layout.tsx`
- Modify: `apps/web/src/components/timeline/items-layer.tsx`
- Modify: `apps/web/src/components/timeline/items-layer.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Make the table column fill height in `split-layout.tsx`**

In the shared-scroll body, the inner flex row and the table-column div need `min-h-full`. Change:

```tsx
					<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
						<div className="flex">
							<div
								data-testid="timeline-table-column"
								className="relative z-20 shrink-0 overflow-hidden border-r border-border bg-background-primary"
								style={{ width: tableWidth }}
							>
								{table}
							</div>
```
to:
```tsx
					<div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
						<div className="flex min-h-full">
							<div
								data-testid="timeline-table-column"
								className="relative z-20 min-h-full shrink-0 overflow-hidden border-r border-border bg-background-primary"
								style={{ width: tableWidth }}
							>
								{table}
							</div>
```

(Only `min-h-full` is added in two places; nothing else changes. The `absolute inset-0` scroll container has a definite height, so `min-h-full` makes the row/column at least the visible height; with many rows the content still grows and scrolls.)

- [ ] **Step 2: Remove the dead empty overlay from `items-layer.tsx`**

Delete the `timeline-items-empty` block (added in the prior slice) — the empty-state screen now supersedes it. Remove exactly:

```tsx
			{!isError && !isLoading && items.length === 0 && (
				<div
					data-testid="timeline-items-empty"
					className="pointer-events-none absolute inset-x-0 top-6 text-center text-sm text-muted-foreground"
				>
					No tasks yet
				</div>
			)}
```

Keep the `timeline-items-error` overlay and the `timeline-items-unscheduled` note. `isLoading` may now be unused in the destructure — if so, remove `isLoading` from the `useTimelineData()` destructure in this file to satisfy lint (keep `isError` and `undatedTaskRows`, which are still used).

- [ ] **Step 3: Drop the empty-overlay test cases from `items-layer.test.tsx`**

In the "ItemsLayer state overlays" describe block, remove the three tests that assert `timeline-items-empty` ("shows the empty state when there are no tasks and not loading", "does not show the empty state while loading", "does not show the empty state when there is an error"). Keep the error-overlay test and the unscheduled-note tests. (The empty-state behavior is now covered by `timeline-view.test.tsx`.)

- [ ] **Step 4: Full verification**

Run from repo root: `pnpm typecheck && pnpm check && cd apps/web && pnpm test`
Expected: typecheck clean; biome — only pre-existing unrelated repo issues may remain (failures in files you touched block); FULL web suite passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/timeline/layout/split-layout.tsx apps/web/src/components/timeline/items-layer.tsx apps/web/src/components/timeline/items-layer.test.tsx
git commit -m "feat(web): full-height timeline table column; drop superseded empty overlay"
```

---

## Self-review notes

- **Spec coverage:** `useCreateTask` (Task 1), `projectId` on context (Task 2), `CreateTaskDialog` (Task 3), `TimelineEmptyState` (Task 4), `TimelineView` gate (Task 5), full-height table + dead-overlay removal (Task 6). Tests for hook, dialog, empty state, view gate, and context. Loading/error gate handling covered by Task 5 tests.
- **Type consistency:** `useCreateTask(projectId)` (Task 1) consumed by `CreateTaskDialog` (Task 3); `CreateTaskDialog` props (`projectId`, `open`, `onOpenChange`) consumed by `TimelineEmptyState` (Task 4); `projectId` added to the context value (Task 2) consumed by `TimelineView` (Task 5). `CreateTaskInput` from `@orbit/shared`. The empty-state gate condition is identical in the spec, Task 5 code, and Task 5 tests.
- **Deviation note:** the create dialog sends `{ name, startDate?, endDate? }` only (spec's "name + optional dates"); other `CreateTaskInput` fields (status/priority/labels/assignee) are intentionally omitted (server defaults apply).
- **Known follow-ups (out of scope):** task edit/delete; click-to-create on empty lanes; drag persistence.
