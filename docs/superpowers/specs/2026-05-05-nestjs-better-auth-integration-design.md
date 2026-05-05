# Design: @thallesp/nestjs-better-auth Integration

**Date:** 2026-05-05  
**Branch:** feat/error-handling-foundation  
**Scope:** `apps/api`

## Goal

Replace the manual NestJS better-auth boilerplate (custom provider, controller, guard, decorators) with `@thallesp/nestjs-better-auth` to get a global auth guard, `@AllowAnonymous()`, `@OrgRoles()`, hook DI, and `AuthService`.

## Chosen Approach

**Full migration to static auth instance.** The `betterAuth` instance moves from a NestJS DI factory in `auth.module.ts` to the existing standalone `auth.ts` file (which already exists for CLI use). Email hooks are inlined in `auth.ts` using a direct Resend instance reading from `process.env` — the same pattern `auth.ts` already uses for all other config.

## Architecture

### Before

```
AuthModule
  └─ AUTH provider (betterAuth factory — injects ConfigService, EmailService, DB)
  └─ AuthController (@All("*path") → toNodeHandler)

AuthGuard (opt-in @UseGuards per controller)
  └─ @Inject(AUTH) → auth.api.getSession()

@CurrentUser() / @CurrentSession() decorators
  └─ import AuthenticatedRequest from auth.guard

ChatGateway
  └─ @Inject(AUTH) → auth.api.getSession() for socket auth
```

### After

```
auth.ts (static instance — email hooks inline via Resend + process.env)
  └─ AuthModule.forRoot({ auth })  [from @thallesp/nestjs-better-auth]
       └─ registers AuthService globally
       └─ registers built-in auth controller
       └─ registers global AuthGuard

@AllowAnonymous()  — marks routes as public (stripe webhook only)
@Session()         — package decorator (optional; @CurrentUser/@CurrentSession kept)
@OrgRoles()        — available for future org-scoped RBAC

ChatGateway
  └─ AuthService.api.getSession() for socket auth
```

## File Changes

### Add

| File | Description |
|---|---|
| `apps/api/src/auth/types.ts` | `User` and `Session` interfaces (moved from `auth.types.ts`, minus `AUTH`/`Auth`) |

### Modify

| File | Change |
|---|---|
| `apps/api/package.json` | add `@thallesp/nestjs-better-auth` |
| `apps/api/src/auth/auth.ts` | add email hooks (inline Resend) + full org hooks from `auth.module.ts` |
| `apps/api/src/auth/auth.module.ts` | replace body — re-export package's `AuthModule.forRoot({ auth })` as a named `AuthModule` so `app.module.ts` import is unchanged |
| `apps/api/src/common/decorators/current-user.decorator.ts` | update import: `AuthenticatedRequest` → from `auth/types` |
| `apps/api/src/common/decorators/current-session.decorator.ts` | update import: `AuthenticatedRequest` → from `auth/types` |
| `apps/api/src/chat/chat.gateway.ts` | replace `@Inject(AUTH) auth: Auth` → inject `AuthService`; update `getSession` call |
| `apps/api/src/billing/stripe-webhook.controller.ts` | add `@AllowAnonymous()` |
| `apps/api/src/billing/billing.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/chat/attachments/attachments.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/chat/channels/channels.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/chat/conversations/conversations.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/chat/messages/messages.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/chat/presence/presence.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/preferences/preferences.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/uploads/uploads.controller.ts` | remove `@UseGuards(AuthGuard)` |
| `apps/api/src/main.ts` | add `bodyParser: false` to `NestFactory.create` options |

### Delete

| File | Reason |
|---|---|
| `apps/api/src/auth/auth.controller.ts` | replaced by package's built-in controller |
| `apps/api/src/auth/auth.types.ts` | `AUTH`/`Auth` go away; `User`/`Session` move to `types.ts` |
| `apps/api/src/auth/auth.constants.ts` | re-exported from `auth.types.ts` — no longer needed |
| `apps/api/src/common/guards/auth.guard.ts` | replaced by package's global guard |

## Key Details

### Email hooks in auth.ts

The current `auth.module.ts` email hooks use `EmailService` (injectable). In `auth.ts` we replace this with a direct inline pattern:

```ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY!);
const from = process.env.EMAIL_FROM ?? "Orbit <onboarding@resend.dev>";
```

Then call the same email template functions already used by `EmailService`. No logic change — same templates, same Resend API.

### main.ts change

```ts
const app = await NestFactory.create(AppModule, {
  bodyParser: false,  // required by @thallesp/nestjs-better-auth
  rawBody: true,
  logger: ["error", "warn", "log", "debug", "verbose"],
});
```

The package handles its own body parsing for auth routes.

### Public routes

Only `stripe-webhook.controller.ts` needs `@AllowAnonymous()`. All other non-auth routes are currently guarded and remain protected under the global guard.

### ChatGateway

```ts
// Before
@Inject(AUTH) private readonly auth: Auth
this.auth.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) })

// After
constructor(private readonly authService: AuthService<typeof auth>, ...)
this.authService.api.getSession({ headers: fromNodeHeaders(socket.handshake.headers) })
```

### AuthenticatedRequest

The `AuthenticatedRequest` interface (currently in `auth.guard.ts`) moves to `auth/types.ts` alongside `User` and `Session`. The package still attaches `user` and `session` to the request, so the interface shape is unchanged.

## Out of Scope

- Adding `@OrgRoles()` to existing controllers (future work)
- Adding `@Hook()` / `@DatabaseHook()` decorators (future work)
- Replacing `@CurrentUser()` / `@CurrentSession()` with the package's `@Session()` decorator (optional, low priority)
