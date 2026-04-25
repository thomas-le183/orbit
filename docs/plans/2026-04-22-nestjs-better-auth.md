# nestjs-better-auth Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hand-rolled better-auth NestJS integration with `@thallesp/nestjs-better-auth` to get a global auth guard, hook decorators, and org-role decorators out of the box.

**Architecture:** Install the library, wire `AuthModule.forRoot()` in `app.module.ts`, delete the custom guard/controller/decorators that the library now owns, then clean up every import site. The standalone `auth.ts` instance stays — it's used by both the library and the CLI.

**Tech Stack:** `@thallesp/nestjs-better-auth`, `better-auth`, NestJS, Drizzle

---

### Task 1: Install the package

**Files:**
- Modify: `apps/api/package.json`

**Step 1: Add the dependency**

Run from repo root:
```bash
cd apps/api && pnpm add @thallesp/nestjs-better-auth
```

**Step 2: Verify install**
```bash
pnpm list @thallesp/nestjs-better-auth
```
Expected: version printed with no errors.

**Step 3: Commit**
```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add @thallesp/nestjs-better-auth"
```

---

### Task 2: Update `main.ts` — disable built-in body parser

The library manages its own body parser. NestJS's default body parser must be disabled so they don't conflict. Raw body support (needed for Stripe webhooks) moves into the library config in Task 3.

**Files:**
- Modify: `apps/api/src/main.ts`

**Step 1: Remove `rawBody: true` from `NestFactory.create` and add `bodyParser: false`**

Current:
```ts
const app = await NestFactory.create(AppModule, { rawBody: true });
```

Replace with:
```ts
const app = await NestFactory.create(AppModule, { bodyParser: false });
```

The full updated `main.ts`:
```ts
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
```

**Step 2: Typecheck**
```bash
cd apps/api && pnpm typecheck
```
Expected: no errors.

---

### Task 3: Wire `AuthModule.forRoot()` in `app.module.ts`

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Step 1: Replace the existing `AuthModule` import with the library's `AuthModule.forRoot()`**

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { auth } from "./auth/auth";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: [".env", "../../.env"],
    }),
    AuthModule.forRoot({
      auth,
      disableTrustedOriginsCors: true, // we handle CORS in main.ts
      bodyParser: {
        json: { limit: "5mb" },
        urlencoded: { limit: "5mb", extended: true },
        rawBody: true, // needed for Stripe webhook signature verification
      },
    }),
    DbModule,
    StorageModule,
    BillingModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Step 2: Typecheck**
```bash
cd apps/api && pnpm typecheck
```

Expected: errors about `AUTH` symbol and our old `AuthModule` still being imported in other modules — these get fixed in subsequent tasks.

---

### Task 4: Delete custom auth infrastructure

The library replaces our `AuthController`, `AuthGuard`, `auth.types.ts`, and `auth.constants.ts`.

**Files to delete:**
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.types.ts`
- `apps/api/src/auth/auth.constants.ts`
- `apps/api/src/common/guards/auth.guard.ts`

**Step 1: Delete the files**
```bash
cd apps/api
rm src/auth/auth.controller.ts
rm src/auth/auth.module.ts
rm src/auth/auth.types.ts
rm src/auth/auth.constants.ts
rm src/common/guards/auth.guard.ts
```

**Step 2: Verify deletion**
```bash
ls src/auth/
```
Expected: only `auth.ts` remains.

---

### Task 5: Update `@CurrentUser()` and `@CurrentSession()` decorators

The library sets `req.user` (the user object) and `req.session` (the session object from better-auth, which includes `activeOrganizationId`). Our decorators read these same properties — they keep working as-is, but need their import of `AuthenticatedRequest` from the deleted guard replaced with a local interface.

**Files:**
- Modify: `apps/api/src/common/decorators/current-user.decorator.ts`
- Modify: `apps/api/src/common/decorators/current-session.decorator.ts`

**Step 1: Update `current-user.decorator.ts`**

```ts
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user: unknown }>();
    return request.user;
  },
);
```

**Step 2: Update `current-session.decorator.ts`**

```ts
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { session: unknown }>();
    return request.session;
  },
);
```

---

### Task 6: Update `billing.module.ts` — remove `AuthModule` import

`BillingModule` previously imported our custom `AuthModule` to get the `AUTH` symbol for the guard. The global guard is now provided by the library — no module import needed.

**Files:**
- Modify: `apps/api/src/billing/billing.module.ts`

**Step 1: Remove `AuthModule` import**

```ts
import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
  providers: [StripeService, BillingService],
  controllers: [BillingController, StripeWebhookController],
  exports: [BillingService],
})
export class BillingModule {}
```

---

### Task 7: Update `billing.controller.ts` — remove guard, update user import

**Files:**
- Modify: `apps/api/src/billing/billing.controller.ts`

**Step 1: Remove `@UseGuards(AuthGuard)` and update imports**

Replace the import block:
```ts
// Remove:
import { AuthGuard } from "../common/guards/auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { User } from "../auth/auth.constants";

// Keep (already there, no change needed for User type — re-define inline or import from better-auth):
```

The updated top of the file:
```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import type {
  CheckoutResponse,
  PortalResponse,
  SubscriptionResponse,
  SubscriptionTier,
} from "@orbit/shared";
import { TIER_METADATA } from "@orbit/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

interface User {
  id: string;
  email: string;
  name: string;
}

@Controller("billing")
export class BillingController {
  // ... rest unchanged
```

Remove `@UseGuards(AuthGuard)` from the class decorator:
```ts
// Before:
@Controller("billing")
@UseGuards(AuthGuard)
export class BillingController {

// After:
@Controller("billing")
export class BillingController {
```

---

### Task 8: Update `stripe-webhook.controller.ts` — add `@AllowAnonymous()`

The Stripe webhook endpoint does not use session cookies — it authenticates via HMAC signature. It must bypass the global auth guard.

**Files:**
- Modify: `apps/api/src/billing/stripe-webhook.controller.ts`

**Step 1: Add `@AllowAnonymous()` to the controller class**

```ts
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

// ... existing interfaces ...

@AllowAnonymous()
@Controller("billing/webhook")
export class StripeWebhookController {
  // ... unchanged
```

---

### Task 9: Update `chat.gateway.ts` — replace `@Inject(AUTH)` with `AuthService`

The WebSocket gateway previously injected the raw `auth` instance via the `AUTH` symbol. That symbol no longer exists. Replace it with `AuthService` from the library.

**Files:**
- Modify: `apps/api/src/chat/chat.gateway.ts`

**Step 1: Update import and constructor**

Replace:
```ts
import { Inject } from "@nestjs/common";
import { AUTH, type Auth, type Session, type User } from "../auth/auth.constants";
```

With:
```ts
import { AuthService } from "@thallesp/nestjs-better-auth";
```

Define `User` and `Session` types locally (or import from `better-auth`):
```ts
import type { Session, User } from "better-auth/types";
```

Update the constructor:
```ts
// Before:
constructor(
  @Inject(AUTH) private readonly auth: Auth,
  @Inject(DB) private readonly db: Db,
  private readonly messagesService: MessagesService,
  private readonly presenceService: PresenceService,
) {}

// After:
constructor(
  private readonly authService: AuthService,
  @Inject(DB) private readonly db: Db,
  private readonly messagesService: MessagesService,
  private readonly presenceService: PresenceService,
) {}
```

Update `handleConnection` to use `this.authService.api`:
```ts
async handleConnection(socket: AuthenticatedSocket) {
  const result = await this.authService.api.getSession({
    headers: fromNodeHeaders(socket.handshake.headers),
  });
  // ... rest unchanged
```

---

### Task 10: Update all chat controllers — remove guard and update imports

Controllers affected:
- `apps/api/src/chat/messages/messages.controller.ts`
- `apps/api/src/chat/conversations/conversations.controller.ts`
- `apps/api/src/chat/channels/channels.controller.ts`
- `apps/api/src/chat/presence/presence.controller.ts`
- `apps/api/src/chat/attachments/attachments.controller.ts`

For each controller:

**Step 1: Remove these lines**
```ts
import { AuthGuard } from "../../common/guards/auth.guard";
// and remove from @UseGuards:
@UseGuards(AuthGuard)
```

**Step 2: If the controller imported `User` or `Session` from `auth.constants`, define them locally**

The types were in `auth.constants.ts` which is now deleted. Either:
- Import from `better-auth/types`: `import type { Session, User } from "better-auth/types"`  
- Or define a minimal local interface: `interface User { id: string; email: string; name: string }`

The `@CurrentUser()` and `@CurrentSession()` decorators still work — only the type annotation changes.

**Step 3: Remove `UseGuards` from `@nestjs/common` import if it's only used for `AuthGuard`**

Example diff for `messages.controller.ts`:
```ts
// Before:
import { ..., UseGuards } from "@nestjs/common";
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import type { Session, User } from "../../auth/auth.constants";

@Controller("channels/:channelId/messages")
@UseGuards(AuthGuard)
export class MessagesController {

// After:
import { ... } from "@nestjs/common"; // remove UseGuards if unused
import { CurrentSession } from "../../common/decorators/current-session.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { Session } from "better-auth/types";

interface User { id: string; email: string; name: string; }

@Controller("channels/:channelId/messages")
export class MessagesController {
```

---

### Task 11: Final typecheck and smoke test

**Step 1: Full typecheck**
```bash
cd /path/to/repo && pnpm typecheck
```
Expected: `Tasks: 5 successful, 5 total` with no errors.

**Step 2: Start the API and verify auth routes respond**
```bash
cd apps/api && pnpm dev
```

```bash
# Should get 401 (global guard working)
curl http://localhost:8000/api/billing/test-org/subscription

# Better-auth routes should respond (library's built-in controller)
curl http://localhost:8000/api/auth/get-session
```

**Step 3: Commit everything**
```bash
git add -A
git commit -m "feat(api): migrate to @thallesp/nestjs-better-auth

- Replace custom AuthModule, AuthGuard, AuthController with library
- Global auth guard now active by default; remove @UseGuards from all controllers
- Stripe webhook exempted via @AllowAnonymous()
- ChatGateway uses AuthService instead of raw AUTH symbol
- Decorators @CurrentUser() / @CurrentSession() updated for library request shape"
```
