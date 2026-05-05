# nestjs-better-auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual NestJS better-auth boilerplate (custom provider, controller, guard, decorators) with `@thallesp/nestjs-better-auth` to get a global auth guard, `@AllowAnonymous()`, org-role decorators, and `AuthService`.

**Architecture:** The `betterAuth` instance moves from a NestJS DI factory to the existing standalone `auth.ts`, with email hooks inlined using a direct Resend instance reading from `process.env`. `AuthModule.forRoot({ auth })` from the package replaces the hand-rolled module, registers a global guard and built-in auth controller, and exposes `AuthService` for injection anywhere.

**Tech Stack:** NestJS, `@thallesp/nestjs-better-auth@^2.6.0`, `better-auth`, Drizzle ORM, Resend SDK, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/api/package.json` | modify | add dependency |
| `apps/api/src/auth/auth.ts` | modify | add email + org hooks (inline Resend) |
| `apps/api/src/auth/auth.module.ts` | replace | `AuthModule.forRoot({ auth })` re-export |
| `apps/api/src/auth/types.ts` | create | `User`, `Session`, `AuthenticatedRequest` interfaces |
| `apps/api/src/auth/auth.types.ts` | delete | absorbed into types.ts |
| `apps/api/src/auth/auth.constants.ts` | delete | re-export of auth.types — no longer needed |
| `apps/api/src/auth/auth.controller.ts` | delete | replaced by package's built-in controller |
| `apps/api/src/common/guards/auth.guard.ts` | delete | replaced by package's global guard |
| `apps/api/src/common/decorators/current-user.decorator.ts` | modify | update import source |
| `apps/api/src/common/decorators/current-session.decorator.ts` | modify | update import source |
| `apps/api/src/main.ts` | modify | add `bodyParser: false` |
| `apps/api/src/chat/chat.gateway.ts` | modify | swap `AUTH` inject → `AuthService` |
| `apps/api/src/billing/stripe-webhook.controller.ts` | modify | add `@AllowAnonymous()` |
| `apps/api/src/billing/billing.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/uploads/uploads.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/preferences/preferences.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/chat/channels/channels.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/chat/messages/messages.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/chat/conversations/conversations.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/chat/attachments/attachments.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |
| `apps/api/src/chat/presence/presence.controller.ts` | modify | remove `@UseGuards(AuthGuard)`, update imports |

---

## Task 1: Install package and create shared types file

**Files:**
- Modify: `apps/api/package.json` (via pnpm)
- Create: `apps/api/src/auth/types.ts`

- [ ] **Step 1: Install the package**

Run from repo root:
```bash
cd apps/api && pnpm add @thallesp/nestjs-better-auth
```

Expected: package appears in `apps/api/package.json` dependencies.

- [ ] **Step 2: Create `apps/api/src/auth/types.ts`**

This file consolidates `User`, `Session`, and `AuthenticatedRequest` so all controllers have one place to import from once `auth.constants.ts` is deleted.

```typescript
import type { Request } from "express";

export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
	ipAddress?: string | null;
	userAgent?: string | null;
	activeOrganizationId?: string | null;
}

export interface AuthenticatedRequest extends Request {
	session: Session;
	user: User;
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: no new errors (existing errors are fine, new file adds no issues).

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/api/src/auth/types.ts pnpm-lock.yaml
git commit -m "feat(api): install @thallesp/nestjs-better-auth, add shared auth types"
```

---

## Task 2: Extend auth.ts with email hooks and full org hooks

**Files:**
- Modify: `apps/api/src/auth/auth.ts`

The current `auth.ts` has a minimal config (no email hooks) — it was only used by the CLI. We extend it to be the full runtime config by adding a Resend instance and all hooks from `auth.module.ts`.

- [ ] **Step 1: Replace `apps/api/src/auth/auth.ts` with the full config**

```typescript
import path from "node:path";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import * as dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Resend } from "resend";
import * as schema from "../db/schema";
import { invitationEmail } from "../email/templates/invitation";
import { memberJoinedEmail } from "../email/templates/member-joined";
import { resetPasswordEmail } from "../email/templates/reset-password";
import { verifyEmailTemplate } from "../email/templates/verify-email";
import { welcomeEmail } from "../email/templates/welcome";
import { workspaceCreatedEmail } from "../email/templates/workspace-created";

expand(dotenv.config({ path: path.resolve(__dirname, "../../.env") }));
expand(dotenv.config({ path: path.resolve(__dirname, "../../../../.env") }));

const db = drizzle(process.env.DATABASE_URL!, { schema });

const resend = new Resend(process.env.RESEND_API_KEY!);
const emailFrom =
	process.env.EMAIL_FROM ?? "Orbit <onboarding@resend.dev>";
const appUrl = process.env.APP_URL ?? "http://localhost:5173";

async function sendEmail(
	to: string,
	template: { subject: string; html: string },
): Promise<void> {
	await resend.emails.send({
		from: emailFrom,
		to: [to],
		subject: template.subject,
		html: template.html,
	});
}

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: process.env.BETTER_AUTH_URL!,
	trustedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "").split(","),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	advanced: {
		cookiePrefix: "orbit",
	},

	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			void sendEmail(user.email, verifyEmailTemplate(user.name, url));
		},
		afterEmailVerification: async (user) => {
			void sendEmail(user.email, welcomeEmail(user.name));
		},
	},

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			void sendEmail(user.email, resetPasswordEmail(user.name, url));
		},
	},

	user: {
		deleteUser: { enabled: true },
	},

	plugins: [
		organization({
			allowUserToCreateOrganization: true,
			teams: {
				enabled: true,
				defaultTeam: { enabled: false },
			},

			sendInvitationEmail: async (data) => {
				void sendEmail(
					data.email,
					invitationEmail({
						inviterName: data.inviter.user.name,
						organizationName: data.organization.name,
						inviteUrl: `${appUrl}/invite/${data.id}`,
					}),
				);
			},

			organizationHooks: {
				afterCreateOrganization: async ({ organization: org, user: owner }) => {
					void sendEmail(
						owner.email,
						workspaceCreatedEmail({
							ownerName: owner.name,
							organizationName: org.name,
							workspaceUrl: `${appUrl}/${org.slug}`,
						}),
					);
				},

				afterAcceptInvitation: async ({
					invitation,
					user: newMember,
					organization: org,
				}) => {
					const inviter = await db.query.user.findFirst({
						where: eq(schema.user.id, invitation.inviterId),
					});
					if (inviter) {
						void sendEmail(
							inviter.email,
							memberJoinedEmail({
								newMemberName: newMember.name,
								newMemberEmail: newMember.email,
								organizationName: org.name,
								workspaceUrl: `${appUrl}/${org.slug}`,
							}),
						);
					}
				},

				beforeCreateInvitation: async () => {},
				afterCreateInvitation: async () => {},
				beforeCancelInvitation: async () => {},
				afterCancelInvitation: async () => {},
				beforeRejectInvitation: async () => {},
				afterRejectInvitation: async () => {},
				beforeCreateOrganization: async () => {},
				beforeUpdateOrganization: async () => {},
				afterUpdateOrganization: async () => {},
				beforeDeleteOrganization: async () => {},
				afterDeleteOrganization: async () => {},
				beforeCreateTeam: async () => {},
				afterCreateTeam: async () => {},
				beforeUpdateTeam: async () => {},
				afterUpdateTeam: async () => {},
				beforeDeleteTeam: async () => {},
				beforeAddMember: async () => {},
				afterAddMember: async () => {},
				beforeUpdateMemberRole: async () => {},
				afterUpdateMemberRole: async () => {},
				beforeRemoveMember: async () => {},
				afterRemoveMember: async () => {},
				beforeAddTeamMember: async () => {},
				afterAddTeamMember: async () => {},
				beforeRemoveTeamMember: async () => {},
				afterRemoveTeamMember: async () => {},
				beforeAcceptInvitation: async () => {},
			},
		}),
	],
});
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: no errors in `auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/auth/auth.ts
git commit -m "feat(api): extend auth.ts with full email hooks and org hooks"
```

---

## Task 3: Replace auth.module.ts and update main.ts

**Files:**
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Replace `apps/api/src/auth/auth.module.ts`**

The `AuthModule` named export must be kept so `app.module.ts` import is unchanged. The package's `AuthModule.forRoot()` returns a `DynamicModule` which NestJS accepts directly in the `imports` array.

```typescript
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth";

export const AuthModule = BetterAuthModule.forRoot({
	auth,
	bodyParser: {
		json: { limit: "2mb" },
		urlencoded: { limit: "2mb", extended: true },
	},
});
```

- [ ] **Step 2: Update `apps/api/src/main.ts`**

Add `bodyParser: false` to `NestFactory.create` — the package handles body parsing for auth routes itself. Keep all other configuration unchanged.

```typescript
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LatencyInterceptor } from "./common/interceptors/latency.interceptor";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
		rawBody: true,
		logger: ["error", "warn", "log", "debug", "verbose"],
	});

	app.setGlobalPrefix("api");

	app.useGlobalFilters(new HttpExceptionFilter());

	app.useGlobalPipes(
		new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
	);

	if (process.env.NODE_ENV === "development") {
		app.useGlobalInterceptors(new LatencyInterceptor());
	}

	app.use(cookieParser());

	app.enableCors({
		origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [],
		credentials: true,
	});

	await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: no errors introduced by these two files.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/auth.module.ts apps/api/src/main.ts
git commit -m "feat(api): wire AuthModule.forRoot, disable bodyParser in NestFactory"
```

---

## Task 4: Update common decorators

**Files:**
- Modify: `apps/api/src/common/decorators/current-user.decorator.ts`
- Modify: `apps/api/src/common/decorators/current-session.decorator.ts`

Both decorators currently import `AuthenticatedRequest` from the guard file we are about to delete. Redirect the import to the new `types.ts`.

- [ ] **Step 1: Update `current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../auth/types";

export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
		return request.user;
	},
);
```

- [ ] **Step 2: Update `current-session.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../auth/types";

export const CurrentSession = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
		return request.session;
	},
);
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/decorators/current-user.decorator.ts apps/api/src/common/decorators/current-session.decorator.ts
git commit -m "refactor(api): update decorator imports to use auth/types"
```

---

## Task 5: Update chat.gateway.ts

**Files:**
- Modify: `apps/api/src/chat/chat.gateway.ts`

The gateway injects the `AUTH` symbol to call `getSession` on WebSocket connections. Replace with `AuthService` from the package.

- [ ] **Step 1: Update imports in `chat.gateway.ts`**

Replace the `AUTH`/`Auth`/`Session`/`User` import block at the top:

```typescript
// Remove this:
import {
	AUTH,
	type Auth,
	type Session,
	type User,
} from "../auth/auth.constants";

// Replace with:
import { AuthService } from "@thallesp/nestjs-better-auth";
import { auth } from "../auth/auth";
import type { Session, User } from "../auth/types";
```

- [ ] **Step 2: Update constructor injection**

```typescript
// Remove:
@Inject(AUTH) private readonly auth: Auth,

// Replace with:
private readonly authService: AuthService<typeof auth>,
```

- [ ] **Step 3: Update getSession call in handleConnection**

```typescript
// Remove:
const result = await this.auth.api.getSession({
    headers: fromNodeHeaders(socket.handshake.headers),
});

// Replace with:
const result = await this.authService.api.getSession({
    headers: fromNodeHeaders(socket.handshake.headers),
});
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: no errors in `chat.gateway.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/chat/chat.gateway.ts
git commit -m "refactor(api): replace AUTH inject with AuthService in ChatGateway"
```

---

## Task 6: Add @AllowAnonymous to stripe webhook controller

**Files:**
- Modify: `apps/api/src/billing/stripe-webhook.controller.ts`

The Stripe webhook receives calls from Stripe's servers — no user session. With the global guard now active, it must be explicitly marked public.

- [ ] **Step 1: Add `@AllowAnonymous()` to `stripe-webhook.controller.ts`**

Add the import and decorator:

```typescript
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	Logger,
	Post,
	RawBody,
} from "@nestjs/common";
// ... rest of imports unchanged
```

Add the decorator to the controller class:

```typescript
@AllowAnonymous()
@Controller("billing/webhook")
export class StripeWebhookController {
  // ... unchanged
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/billing/stripe-webhook.controller.ts
git commit -m "feat(api): mark stripe webhook as AllowAnonymous for global guard"
```

---

## Task 7: Remove @UseGuards from all protected controllers

**Files:**
- Modify: `apps/api/src/billing/billing.controller.ts`
- Modify: `apps/api/src/uploads/uploads.controller.ts`
- Modify: `apps/api/src/preferences/preferences.controller.ts`
- Modify: `apps/api/src/chat/channels/channels.controller.ts`
- Modify: `apps/api/src/chat/messages/messages.controller.ts`
- Modify: `apps/api/src/chat/conversations/conversations.controller.ts`
- Modify: `apps/api/src/chat/attachments/attachments.controller.ts`
- Modify: `apps/api/src/chat/presence/presence.controller.ts`

The global guard now protects all routes. The `@UseGuards(AuthGuard)` decorator and its import can be removed from every controller. Also update `User`/`Session` imports from `auth.constants` → `auth/types`.

For each file below, make both changes: (1) remove `AuthGuard` import + `@UseGuards` decorator, (2) redirect `User`/`Session` import.

- [ ] **Step 1: Update `billing/billing.controller.ts`**

```typescript
// Remove these two lines:
import { AuthGuard } from "../common/guards/auth.guard";
import type { User } from "../auth/auth.constants";

// Add:
import type { User } from "../auth/types";

// Remove from @nestjs/common imports: UseGuards
// Remove from class decorator: @UseGuards(AuthGuard)
```

The `@nestjs/common` import becomes (remove `UseGuards`):
```typescript
import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	Post,
} from "@nestjs/common";
```

- [ ] **Step 2: Update `uploads/uploads.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../common/guards/auth.guard";
import type { User } from "../auth/auth.constants";

// Add:
import type { User } from "../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 3: Update `preferences/preferences.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../common/guards/auth.guard";
import type { User } from "../auth/auth.constants";

// Add:
import type { User } from "../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 4: Update `chat/channels/channels.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../../common/guards/auth.guard";
import type { Session, User } from "../../auth/auth.constants";

// Add:
import type { Session, User } from "../../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 5: Update `chat/messages/messages.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../../common/guards/auth.guard";
import type { Session, User } from "../../auth/auth.constants";

// Add:
import type { Session, User } from "../../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 6: Update `chat/conversations/conversations.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../../common/guards/auth.guard";
import type { Session, User } from "../../auth/auth.constants";

// Add:
import type { Session, User } from "../../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 7: Update `chat/attachments/attachments.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../../common/guards/auth.guard";
import type { User } from "../../auth/auth.constants";

// Add:
import type { User } from "../../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 8: Update `chat/presence/presence.controller.ts`**

```typescript
// Remove:
import { AuthGuard } from "../../common/guards/auth.guard";
import type { Session, User } from "../../auth/auth.constants";

// Add:
import type { Session, User } from "../../auth/types";

// Remove UseGuards from @nestjs/common imports
// Remove @UseGuards(AuthGuard) from class
```

- [ ] **Step 9: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: errors only about `AuthGuard`/`auth.constants`/`auth.guard` not found — those files are deleted in the next task.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/billing/billing.controller.ts \
        apps/api/src/uploads/uploads.controller.ts \
        apps/api/src/preferences/preferences.controller.ts \
        apps/api/src/chat/channels/channels.controller.ts \
        apps/api/src/chat/messages/messages.controller.ts \
        apps/api/src/chat/conversations/conversations.controller.ts \
        apps/api/src/chat/attachments/attachments.controller.ts \
        apps/api/src/chat/presence/presence.controller.ts
git commit -m "refactor(api): remove @UseGuards(AuthGuard) — covered by global guard"
```

---

## Task 8: Delete obsolete files

**Files:**
- Delete: `apps/api/src/auth/auth.controller.ts`
- Delete: `apps/api/src/auth/auth.types.ts`
- Delete: `apps/api/src/auth/auth.constants.ts`
- Delete: `apps/api/src/common/guards/auth.guard.ts`

- [ ] **Step 1: Delete the four files**

```bash
rm apps/api/src/auth/auth.controller.ts \
   apps/api/src/auth/auth.types.ts \
   apps/api/src/auth/auth.constants.ts \
   apps/api/src/common/guards/auth.guard.ts
```

- [ ] **Step 2: Typecheck — must be clean**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: **zero errors**. If errors remain, they point to imports not updated in Task 7 — fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add -A apps/api/src/auth/auth.controller.ts \
           apps/api/src/auth/auth.types.ts \
           apps/api/src/auth/auth.constants.ts \
           apps/api/src/common/guards/auth.guard.ts
git commit -m "refactor(api): delete hand-rolled auth boilerplate replaced by package"
```

---

## Task 9: Build verification

- [ ] **Step 1: Run full build**

```bash
cd /path/to/repo/root && pnpm build
```

Expected: all packages build without error.

- [ ] **Step 2: Run lint**

```bash
pnpm check
```

Fix any Biome lint/format issues that surface.

- [ ] **Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "style(api): fix lint issues after nestjs-better-auth migration"
```

Only create this commit if there are actual changes.
