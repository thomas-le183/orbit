# Projects in Sidebar — Frontend Design

**Date:** 2026-06-29
**Scope:** Display the active organization's projects in the workspace sidebar (Home module), each linking to a project-scoped timeline route, plus a create-project dialog. First slice of frontend wiring against the projects/tasks backend.

## Goal

Surface real projects (from `GET /projects`) in the left sidebar so users can see and navigate between them, and create new ones. This replaces nothing yet — the timeline still renders static seed data; wiring the timeline to a project's tasks/milestones is a **later slice**.

## Decisions

- **Sidebar integration:** the sidebar is config-driven (`resolveModule` → static `SidebarSection`s). Projects are dynamic data, so they render via a dedicated data-fetching component (`ProjectsNavSection`) mounted in `AppSidebar`, NOT through the static config. This keeps `config/navigation.ts` pure.
- **Click target:** a project navigates to a new route `/$orgSlug/projects/$projectId`, which renders the existing timeline view. The `projectId` param is available for the next slice (timeline data); for now the timeline shows seed data.
- **Create UI:** included — a "+ New project" affordance opens a dialog (name required, optional description) calling `POST /projects`. Status defaults server-side.
- **Out of scope this slice:** edit/delete/archive projects; project status/teams/labels in the create dialog; wiring timeline data to the project; project-scoped data fetching.
- **Conventions:** TanStack Query hooks follow `apps/web/src/hooks/use-preferences.ts` (`*Keys` object, `useQuery`/`useMutation`, axios `api`, `invalidateQueries` + `toast`). Forms use `@tanstack/react-form`. Components use `@orbit/ui` and `cn()`. Sidebar primitives from `@orbit/ui/components/sidebar`.

## Architecture

### New files

**`apps/web/src/hooks/use-projects.ts`** — server-state hooks.

```ts
export type Project = {
	id: string;
	organizationId: string;
	name: string;
	description: string | null;
	statusId: string;
	color: string | null;
	startDate: string | null;
	endDate: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
};

export const projectKeys = {
	all: ["projects"] as const,
	list: (orgSlug: string) => ["projects", "list", orgSlug] as const,
};
```

- `useProjects(orgSlug: string)` — `useQuery({ queryKey: projectKeys.list(orgSlug), queryFn: GET /projects })`. Keyed by `orgSlug` so switching orgs refetches rather than showing stale cache. `enabled: !!orgSlug`.
- `useCreateProject(orgSlug: string)` — `useMutation` posting `CreateProjectInput` (from `@orbit/shared`) to `POST /projects`; `onSuccess` invalidates `projectKeys.list(orgSlug)` and toasts success.

The active org is identified by `orgSlug` (the route param); the API itself scopes by the session's active organization, so the request body/query needs no org id. `orgSlug` is used only for cache keying.

**`apps/web/src/components/workspace/projects-nav-section.tsx`** — `ProjectsNavSection({ orgSlug })`.

- Renders a collapsible `SidebarGroup` labelled "Projects" (same `Collapsible` + `SidebarGroupLabel` pattern as `CollapsibleSection` in `app-sidebar.tsx`, persisting open state via `useLocalStorage("sidebar:section:Projects")`).
- States:
  - **Loading:** 3 `SidebarMenuSkeleton` rows (from `@orbit/ui/components/sidebar`).
  - **Empty:** a muted "No projects yet" row.
  - **Loaded:** one `SidebarMenuItem` per project — a small color dot (project.color, fallback to a neutral) + truncated name — navigating to `/$orgSlug/projects/$projectId`. Active when the current route matches that project (via `useMatchRoute`).
- Header action: a `SidebarGroupAction` ("+ New project", icon + sr-only label) that opens `CreateProjectDialog`.

**`apps/web/src/components/workspace/create-project-dialog.tsx`** — `CreateProjectDialog({ orgSlug, open, onOpenChange })`.

- `Dialog` from `@orbit/ui`. `@tanstack/react-form` with fields: `name` (required, non-empty, max 200) and `description` (optional, max 2000).
- Submit → `useCreateProject(orgSlug).mutateAsync({ name, description })`; on success `onOpenChange(false)`, reset form. Submit button disabled while pending. Validation mirrors `createProjectSchema`.

**`apps/web/src/components/timeline/timeline-view.tsx`** — extracted `TimelineView` that renders `<SplitLayout tableHeader={<TimelineTableHeader/>} table={<TimelineTable/>} />`, used by both timeline routes (DRY). Wrapped in the `h-full` container.

**`apps/web/src/routes/_workspace/$orgSlug/projects/$projectId.tsx`** — file route rendering `<TimelineView />`. `projectId` is read from params and intentionally unused this slice (available for the next). The auto-generated `routeTree.gen.ts` regenerates via the Vite plugin — never hand-edited.

### Edits

**`apps/web/src/config/navigation.ts`** — add `"projects"` to the `resolveModule` switch, returning `getHomeConfig(orgSlug)` (so project routes show the Home module's sidebar).

**`apps/web/src/components/workspace/app-sidebar.tsx`** — render `<ProjectsNavSection orgSlug={orgSlug} />` inside `SidebarContent`, after the config sections map, gated by `!isSettings` (Home module only). Refactor `timeline.tsx` to use the extracted `TimelineView`.

## Data flow

```
AppSidebar (Home module)
  └─ ProjectsNavSection(orgSlug)
       └─ useProjects(orgSlug) ── GET /projects ──▶ Project[]
            ├─ render items ── click ──▶ navigate /$orgSlug/projects/$projectId ──▶ TimelineView (seed data)
            └─ "+ New project" ──▶ CreateProjectDialog
                                      └─ useCreateProject(orgSlug) ── POST /projects ──▶ invalidate projectKeys.list ──▶ list refreshes
```

## Error / empty / loading handling

- Query loading → skeleton rows; query error → a muted "Couldn't load projects" row (no toast on read; the global axios interceptor handles 401).
- Create mutation error → error toast (reuse `getErrorMessage` from `@/lib/api`); success → success toast + dialog closes.
- Empty org (no projects) → "No projects yet" row; the "+ New project" action remains available.

## Testing

`apps/web` uses Vitest + Testing Library. Tests:

- `use-projects.test.tsx` — `useProjects` calls `GET /projects` and returns data; `useCreateProject` posts and invalidates the list key (mock `api`, wrap in a QueryClientProvider).
- `projects-nav-section.test.tsx` — renders loading skeleton, empty state, and a list of project items from mocked `useProjects`; clicking an item navigates; "+ New" opens the dialog.
- `create-project-dialog.test.tsx` — name-required validation blocks submit; valid submit calls the mutation and closes on success.

Follow existing timeline test setup for router/query providers.

## Out of scope

- Wiring the timeline to a project's tasks/milestones (next slice).
- Project edit/delete/archive, and status/teams/labels in create.
- Reordering or grouping projects in the sidebar.
- Drag/resize persistence (separate slice).
