# Create Task Button — Design

**Date:** 2026-06-30
**Scope:** Add a "create task" entry point in two places — the sidebar per-project row and the timeline toolbar. Frontend only.

## Goal

Let users start creating a task without first navigating to a project and finding the empty state. Two independent entry points, both opening the existing `CreateTaskDialog`.

## Decisions

- **Two independent entry points, same dialog:** each location owns its own `open` state + `CreateTaskDialog` instance. No shared state or cross-tree communication needed.
- **Sidebar entry point:** a hover-revealed ghost `+` icon button on each project row in `ProjectsNavSection`, matching the existing "New project" `+` button pattern on the section label.
- **Toolbar entry point:** a "New task" `Button` (variant `outline`, size `sm`) in the left side of the timeline toolbar, only rendered when viewing a project (i.e. `projectId` is set). `TimelineView` owns the state and dialog; it passes `onNewTask` down to `SplitLayout`.
- **Seed mode unaffected:** `/timeline` with no `projectId` — `TimelineView` passes no `onNewTask`, so no button appears in the toolbar.

## Architecture

### `components/workspace/projects-nav-section.tsx` (edit)

Extract each project row into a `ProjectNavItem` sub-component (same file). It holds:
- `const [dialogOpen, setDialogOpen] = useState(false)`

The `SidebarMenuButton` keeps its navigate-on-click. A ghost `icon-xs` `Button` with `PlusIcon` appears to the right on hover (`hidden group-hover/item:flex`), calls `e.stopPropagation()`, then `setDialogOpen(true)`. `CreateTaskDialog` renders at the bottom of `ProjectNavItem`.

```tsx
function ProjectNavItem({ project, orgSlug }: { project: Project; orgSlug: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={project.name}
        isActive={!!matchRoute({ to: "/$orgSlug/projects/$projectId", params: { orgSlug, projectId: project.id } })}
        onClick={() => navigate({ to: "/$orgSlug/projects/$projectId", params: { orgSlug, projectId: project.id } })}
        className="group/item"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? "var(--color-muted-foreground)" }} />
        <span className="truncate">{project.name}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`New task in ${project.name}`}
          className="ml-auto hidden group-hover/item:flex"
          onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
        >
          <PlusIcon />
        </Button>
      </SidebarMenuButton>
      <CreateTaskDialog projectId={project.id} open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarMenuItem>
  );
}
```

### `components/timeline/layout/split-layout.tsx` (edit)

Add `onNewTask?: () => void` to `SplitLayoutProps` and thread it through to `SplitLayoutInner`. In the toolbar, render a "New task" `Button` before the pan buttons when `onNewTask` is defined:

```tsx
{onNewTask && (
  <Button variant="outline" size="sm" onClick={onNewTask}>
    <PlusIcon className="size-3.5" />
    New task
  </Button>
)}
```

### `components/timeline/timeline-view.tsx` (edit)

Add local state + dialog, pass `onNewTask` to `SplitLayout` when `projectId` is set:

```tsx
const [newTaskOpen, setNewTaskOpen] = useState(false);
// ...
{isLoadingProject ? <TimelineSkeleton /> :
 isEmptyProject ? <TimelineEmptyState projectId={projectId} /> :
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
 </>}
```

## Data flow

```
Sidebar row hover → PlusIcon click → ProjectNavItem.dialogOpen=true → CreateTaskDialog(projectId)
Timeline toolbar  → "New task" click → onNewTask() → TimelineView.newTaskOpen=true → CreateTaskDialog(projectId)
```

Both resolve through `useCreateTask(projectId)` → `POST /projects/:id/tasks` → invalidate `taskKeys.list(projectId)`.

## Testing

- `projects-nav-section.test.tsx` — add: hover a project row → `+` button appears; click it → `CreateTaskDialog` opens (mock `CreateTaskDialog`; assert it receives the correct `projectId` and `open=true`).
- `timeline-view.test.tsx` — add: when `projectId` is set and tasks exist, the mock `SplitLayout` receives `onNewTask` prop (update mock to surface it); when `projectId` is undefined (seed mode), `onNewTask` is not passed.

## Out of scope

- Keyboard shortcut to open the dialog
- Quick-add inline in the table rows
- Task creation from the empty state (already exists via `TimelineEmptyState`)
