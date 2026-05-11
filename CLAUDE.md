# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Turborepo monorepo with a React frontend, NestJS backend API, and two shared packages.

| Path | Description |
| --- | --- |
| `apps/web` | React 19 + Vite + TanStack Router frontend |
| `apps/api` | NestJS backend API (port 8000) |
| `packages/ui` | Shared shadcn-style component library (`@orbit/ui`) |
| `packages/shared` | Shared types, Zod schemas, and utilities (`@orbit/shared`) |

## Dev commands

Run all commands from the **repo root** unless noted.

```bash
pnpm dev          # start all apps in watch mode (Turbo)
pnpm build        # build all apps/packages
pnpm check        # biome check (lint + format)
pnpm lint         # biome lint only
pnpm format       # biome format only
pnpm typecheck    # tsc type-check across all packages
```

Run tests inside `apps/web` (Vitest):

```bash
cd apps/web && pnpm test             # single pass
cd apps/web && pnpm test -- --watch  # watch mode
```

Run tests inside `apps/api` (Jest):

```bash
cd apps/api && pnpm test
```

Database commands (run from `apps/api`):

```bash
pnpm db:generate   # generate Drizzle migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:push       # push schema directly (dev only)
pnpm db:seed:dev   # seed development data
```

## Architecture

### Frontend–backend communication

The frontend (`apps/web`) talks to the API exclusively via **Axios** (`apps/web/src/lib/api.ts`) with `withCredentials: true` so session cookies are sent automatically. All server state is managed by **TanStack Query** (React Query). Query keys follow the pattern in `apps/web/src/hooks/use-auth.tsx` — colocate related keys in a `*Keys` object.

### Authentication flow

`better-auth` owns the entire auth surface:

- **Backend config**: `apps/api/src/auth/auth.module.ts` — Drizzle adapter, org plugin with teams
- **Frontend client**: `apps/web/src/lib/auth-client.ts` — imported from `better-auth/react` with the organization plugin
- **Auth hooks**: `apps/web/src/hooks/use-auth.tsx` — all auth queries/mutations live here; call these instead of the raw client
- **Route guards**: TanStack Router `beforeLoad` hooks use `loadAuthState()` and `resolveAuthenticatedLanding()` (from `use-auth.tsx`) to redirect unauthenticated users or users with incomplete onboarding
- **API guard**: `apps/api/src/common/guards/auth.guard.ts` validates sessions; use `@CurrentUser()` / `@CurrentSession()` decorators in controllers

#### Dual better-auth instances — strict sync rule

There are two `betterAuth(...)` calls in this repo:

| File | Purpose |
| --- | --- |
| `apps/api/src/auth/auth.ts` | Thin instance for `@better-auth/cli generate` (runs outside NestJS DI) |
| `apps/api/src/auth/auth.module.ts` | Full runtime instance — injected via `AUTH` token |

**Rule**: `auth.ts` must contain every option that affects the database schema (plugins list, `emailAndPassword.enabled`, `user.changeEmail`, `user.deleteUser`, etc.). Runtime-only callbacks (`sendVerificationEmail`, `sendResetPassword`, org hooks, etc.) belong only in `auth.module.ts`.

Whenever you add or remove a plugin, enable/disable a feature, or change any option that adds/removes DB columns or tables, **update both files**. If they diverge on schema-affecting config, generated migrations will be wrong. Always diff the two files when touching auth config.

### Routing structure

`apps/web/src/routes/` uses file-based routing via the TanStack Router Vite plugin:

- `_public.tsx` layout — unauthenticated pages (login, signup, forgot-password)
- `_workspace.tsx` layout — protected pages gated by `beforeLoad` auth checks; all routes under it receive `$orgSlug` as a path param
- `__root.tsx` — top-level providers (QueryClient, ThemeProvider, Sonner toasts)

Route tree is auto-generated at `apps/web/src/routeTree.gen.ts` — **never edit this file manually**.

### Shared packages

- **`@orbit/ui`**: shadcn-style components. Import as `@orbit/ui/components/<Name>`. Add reusable components here, not in `apps/web`.
- **`@orbit/shared`**: shared Zod schemas, TypeScript types, and the `cn()` utility. Both `packages/ui` and `apps/web` depend on this.

### Backend module structure (NestJS)

Feature modules live in `apps/api/src/<feature>/` and follow the NestJS convention of `*.module.ts`, `*.controller.ts`, `*.service.ts`. Root module is `app.module.ts`. All DB access goes through the Drizzle instance injected via the `DB` symbol from `apps/api/src/db/db.module.ts`.

### Database schema

Schema files: `apps/api/src/db/schema/` — `auth.ts` (better-auth tables + org/team/member/invitation) and `chat.ts` (channels, conversations, messages, reactions, presence). Drizzle relations are defined in those files for type-safe `.query.*` calls.

### Real-time

Socket.io WebSocketGateway at `apps/api/src/chat/chat.gateway.ts` handles presence, typing indicators, and live message delivery. Auth is validated on connection using the session cookie.

### Infrastructure (Docker Compose)

Local dev depends on PostgreSQL (port 5433), Redis (6379), RabbitMQ (5672), and RustFS/S3-compatible storage (9000). Start with `docker compose -f docker-compose-local.yml up -d`.

## Code conventions

- **TypeScript**: `camelCase` for variables/functions, `PascalCase` for types/components/classes. Avoid `any`.
- **Styling**: Tailwind CSS v4. Always use `cn()` (from `@orbit/shared`) for conditional class merging.
- **Forms**: `@tanstack/react-form` only — never `react-hook-form` or `formik`.
- **Hooks**: shared hooks → `packages/ui/src/hooks`; app-specific hooks → `apps/web/src/hooks`.
- **Don't** edit `apps/web/src/styles.css` with Biome-aware tools — it is excluded from Biome.
- **Don't** write raw SQL or use any ORM other than Drizzle in `apps/api`.
- **Don't** implement custom auth middleware or session logic — use `better-auth` APIs.

### Settings pages

Settings pages use `SettingsPage` as the outer shell, then `FieldGroup` + `Field` + `FieldContent` + `FieldLabel` + `FieldDescription` from `@orbit/ui/components/field` for layout.

Use `@tanstack/react-form` to manage field state. For controls that save on change (selects, toggles), call both `field.handleChange` and the mutation inside `onValueChange`. When form defaults depend on async data, sync with a `useEffect` + `form.reset` once data first loads.

```tsx
// Label-left / control-right row
<Field orientation="horizontal">
  <FieldContent>
    <FieldLabel>Theme</FieldLabel>
    <FieldDescription>Controls the color scheme</FieldDescription>
  </FieldContent>
  <Select value={field.state.value} onValueChange={(v) => { if (!v) return; field.handleChange(v); mutate({ theme: v }); }}>
    <SelectTrigger className="w-70 shrink-0"><SelectValue /></SelectTrigger>
    <SelectContent>...</SelectContent>
  </Select>
</Field>
```

See `apps/web/src/components/workspace/settings/preferences-settings.tsx` for a full example.

## Package manager

pnpm with workspaces (`pnpm@10`, Node `>=24`). Do not use `yarn` or `npm`.
