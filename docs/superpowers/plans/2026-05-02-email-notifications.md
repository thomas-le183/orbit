# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send transactional emails for key lifecycle events — email verification, password reset, workspace creation, member invitation, and invitation acceptance.

**Architecture:** A standalone `EmailModule` wraps the Resend SDK. better-auth's native email hooks handle verification, password reset, and invitations (they pre-build URLs and pass structured data). Custom `organizationHooks` cover workspace-created and member-joined notifications. Templates are plain TypeScript functions returning `{ subject, html }`.

**better-auth native hooks used:**
- `emailVerification.sendVerificationEmail` — sends verify link on signup
- `emailVerification.afterEmailVerification` — sends welcome email after user verifies
- `emailAndPassword.sendResetPassword` — sends password reset link
- `organization.sendInvitationEmail` — sends invite email (inviter + org data pre-packaged)

**Custom hooks used:**
- `organizationHooks.afterCreateOrganization` — workspace created notification to owner
- `organizationHooks.afterAcceptInvitation` — notify inviter when member joins

**Tech Stack:** Resend SDK (`resend`), NestJS module pattern, better-auth native email hooks, Jest for unit tests.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/email/email.module.ts` | NestJS module, exports EmailService |
| Create | `apps/api/src/email/email.service.ts` | Resend client wrapper, one method per email |
| Create | `apps/api/src/email/templates/verify-email.ts` | Email verification link |
| Create | `apps/api/src/email/templates/welcome.ts` | Welcome email after verification |
| Create | `apps/api/src/email/templates/reset-password.ts` | Password reset link |
| Create | `apps/api/src/email/templates/invitation.ts` | Invitation email with accept link |
| Create | `apps/api/src/email/templates/workspace-created.ts` | Workspace created confirmation to owner |
| Create | `apps/api/src/email/templates/member-joined.ts` | Notify inviter when member accepts |
| Create | `apps/api/src/email/email.service.spec.ts` | Unit tests for EmailService |
| Modify | `apps/api/src/auth/auth.module.ts` | Wire all email hooks via EmailService |
| Modify | `apps/api/src/app.module.ts` | Import EmailModule |
| Modify | `apps/api/package.json` | Add `resend` dependency |
| Modify | `.env` (root) | Add `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` |

---

## Task 1: Install Resend and add env vars

**Files:**
- Modify: `apps/api/package.json`
- Modify: `.env` (repo root)

- [ ] **Step 1: Install resend**

```bash
cd apps/api && pnpm add resend
```

Expected: package added, lockfile updated.

- [ ] **Step 2: Add env vars to `.env`**

Append to the repo-root `.env`:

```env
# Email
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Orbit <onboarding@resend.dev>
APP_URL=http://localhost:5173
```

> Get a free API key at resend.com. Use `onboarding@resend.dev` during dev (Resend's shared domain, no DNS setup needed). Swap `EMAIL_FROM` to your verified domain in prod.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(email): add resend dependency"
```

---

## Task 2: Email templates

**Files:**
- Create: `apps/api/src/email/templates/verify-email.ts`
- Create: `apps/api/src/email/templates/welcome.ts`
- Create: `apps/api/src/email/templates/reset-password.ts`
- Create: `apps/api/src/email/templates/invitation.ts`
- Create: `apps/api/src/email/templates/workspace-created.ts`
- Create: `apps/api/src/email/templates/member-joined.ts`

- [ ] **Step 1: Create verify-email template**

Create `apps/api/src/email/templates/verify-email.ts`:

```typescript
export function verifyEmailTemplate(name: string, url: string): { subject: string; html: string } {
  return {
    subject: "Verify your Orbit email address",
    html: `
      <h2>Hi ${name}, please verify your email</h2>
      <p>Click the button below to verify your email address and activate your account.</p>
      <p><a href="${url}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Verify Email</a></p>
      <p>This link expires in 24 hours. If you didn't create an Orbit account, ignore this email.</p>
      <p>— The Orbit Team</p>
    `,
  };
}
```

- [ ] **Step 2: Create welcome template**

Create `apps/api/src/email/templates/welcome.ts`:

```typescript
export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Welcome to Orbit!",
    html: `
      <h2>You're all set, ${name}!</h2>
      <p>Your email is verified and your Orbit account is ready. Create a workspace to get started.</p>
      <p>— The Orbit Team</p>
    `,
  };
}
```

- [ ] **Step 3: Create reset-password template**

Create `apps/api/src/email/templates/reset-password.ts`:

```typescript
export function resetPasswordEmail(name: string, url: string): { subject: string; html: string } {
  return {
    subject: "Reset your Orbit password",
    html: `
      <h2>Hi ${name}, reset your password</h2>
      <p>Click the button below to choose a new password.</p>
      <p><a href="${url}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
      <p>— The Orbit Team</p>
    `,
  };
}
```

- [ ] **Step 4: Create invitation template**

Create `apps/api/src/email/templates/invitation.ts`:

```typescript
export interface InvitationEmailData {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
}

export function invitationEmail(data: InvitationEmailData): { subject: string; html: string } {
  return {
    subject: `${data.inviterName} invited you to ${data.organizationName} on Orbit`,
    html: `
      <h2>You're invited!</h2>
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on Orbit.</p>
      <p><a href="${data.inviteUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
      <p>This link expires in 48 hours.</p>
      <p>— The Orbit Team</p>
    `,
  };
}
```

- [ ] **Step 5: Create workspace-created template**

Create `apps/api/src/email/templates/workspace-created.ts`:

```typescript
export interface WorkspaceCreatedEmailData {
  ownerName: string;
  organizationName: string;
  workspaceUrl: string;
}

export function workspaceCreatedEmail(data: WorkspaceCreatedEmailData): { subject: string; html: string } {
  return {
    subject: `Your Orbit workspace "${data.organizationName}" is ready`,
    html: `
      <h2>Workspace created!</h2>
      <p>Hi ${data.ownerName}, your workspace <strong>${data.organizationName}</strong> is all set up.</p>
      <p><a href="${data.workspaceUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Open Workspace</a></p>
      <p>— The Orbit Team</p>
    `,
  };
}
```

- [ ] **Step 6: Create member-joined template**

Create `apps/api/src/email/templates/member-joined.ts`:

```typescript
export interface MemberJoinedEmailData {
  newMemberName: string;
  newMemberEmail: string;
  organizationName: string;
  workspaceUrl: string;
}

export function memberJoinedEmail(data: MemberJoinedEmailData): { subject: string; html: string } {
  return {
    subject: `${data.newMemberName} joined ${data.organizationName} on Orbit`,
    html: `
      <h2>New member joined!</h2>
      <p><strong>${data.newMemberName}</strong> (${data.newMemberEmail}) accepted their invitation and joined <strong>${data.organizationName}</strong>.</p>
      <p><a href="${data.workspaceUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View Workspace</a></p>
      <p>— The Orbit Team</p>
    `,
  };
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/email/templates/
git commit -m "feat(email): add transactional email templates"
```

---

## Task 3: EmailService and EmailModule

**Files:**
- Create: `apps/api/src/email/email.service.ts`
- Create: `apps/api/src/email/email.module.ts`
- Create: `apps/api/src/email/email.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/email/email.service.spec.ts`:

```typescript
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Resend } from "resend";
import { EmailService } from "./email.service";

jest.mock("resend");

const mockSend = jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });
(Resend as jest.MockedClass<typeof Resend>).mockImplementation(
  () => ({ emails: { send: mockSend } }) as unknown as Resend,
);

describe("EmailService", () => {
  let service: EmailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "RESEND_API_KEY") return "re_test";
              if (key === "EMAIL_FROM") return "Orbit <noreply@test.com>";
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(EmailService);
    mockSend.mockClear();
  });

  it("sendVerifyEmail calls resend with verify subject", async () => {
    await service.sendVerifyEmail("user@example.com", "Alice", "https://example.com/verify?token=abc");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Verify your Orbit email address",
      }),
    );
  });

  it("sendWelcome calls resend with welcome subject", async () => {
    await service.sendWelcome("user@example.com", "Alice");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Welcome to Orbit!",
      }),
    );
  });

  it("sendResetPassword calls resend with reset subject", async () => {
    await service.sendResetPassword("user@example.com", "Alice", "https://example.com/reset?token=abc");
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Reset your Orbit password",
      }),
    );
  });

  it("sendInvitation includes inviter name in subject", async () => {
    await service.sendInvitation("invitee@example.com", {
      inviterName: "Bob",
      organizationName: "Acme",
      inviteUrl: "http://localhost:5173/invite/abc123",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["invitee@example.com"],
        subject: expect.stringContaining("Bob"),
      }),
    );
  });

  it("sendWorkspaceCreated includes org name in subject", async () => {
    await service.sendWorkspaceCreated("owner@example.com", {
      ownerName: "Carol",
      organizationName: "My Co",
      workspaceUrl: "http://localhost:5173/my-co",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("My Co"),
      }),
    );
  });

  it("sendMemberJoined includes new member name in subject", async () => {
    await service.sendMemberJoined("owner@example.com", {
      newMemberName: "Dave",
      newMemberEmail: "dave@example.com",
      organizationName: "Acme",
      workspaceUrl: "http://localhost:5173/acme",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Dave"),
      }),
    );
  });

  it("does not throw when resend returns an error", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "bad key" } });
    await expect(service.sendWelcome("user@example.com", "Alice")).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && pnpm test -- --testPathPattern=email.service.spec
```

Expected: FAIL — `Cannot find module './email.service'`

- [ ] **Step 3: Implement EmailService**

Create `apps/api/src/email/email.service.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { type InvitationEmailData, invitationEmail } from "./templates/invitation";
import { type MemberJoinedEmailData, memberJoinedEmail } from "./templates/member-joined";
import { resetPasswordEmail } from "./templates/reset-password";
import { verifyEmailTemplate } from "./templates/verify-email";
import { type WorkspaceCreatedEmailData, workspaceCreatedEmail } from "./templates/workspace-created";
import { welcomeEmail } from "./templates/welcome";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.get<string>("RESEND_API_KEY"));
    this.from = config.get<string>("EMAIL_FROM") ?? "Orbit <onboarding@resend.dev>";
  }

  async sendVerifyEmail(to: string, name: string, url: string): Promise<void> {
    await this.send(to, verifyEmailTemplate(name, url));
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.send(to, welcomeEmail(name));
  }

  async sendResetPassword(to: string, name: string, url: string): Promise<void> {
    await this.send(to, resetPasswordEmail(name, url));
  }

  async sendInvitation(to: string, data: InvitationEmailData): Promise<void> {
    await this.send(to, invitationEmail(data));
  }

  async sendWorkspaceCreated(to: string, data: WorkspaceCreatedEmailData): Promise<void> {
    await this.send(to, workspaceCreatedEmail(data));
  }

  async sendMemberJoined(to: string, data: MemberJoinedEmailData): Promise<void> {
    await this.send(to, memberJoinedEmail(data));
  }

  private async send(to: string, template: { subject: string; html: string }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: [to],
      subject: template.subject,
      html: template.html,
    });
    if (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
    }
  }
}
```

- [ ] **Step 4: Create EmailModule**

Create `apps/api/src/email/email.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd apps/api && pnpm test -- --testPathPattern=email.service.spec
```

Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/email/
git commit -m "feat(email): add EmailService with Resend integration"
```

---

## Task 4: Register EmailModule and wire all hooks

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Register EmailModule in AppModule**

Edit `apps/api/src/app.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: [".env", "../../.env"],
    }),
    DbModule,
    StorageModule,
    EmailModule,
    AuthModule,
    BillingModule,
    ChatModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Wire all email hooks in AuthModule**

Replace `apps/api/src/auth/auth.module.ts` with:

```typescript
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { DB, type Db } from "../db/db.module";
import { EmailModule } from "../email/email.module";
import { EmailService } from "../email/email.service";
import * as schema from "../db/schema";
import { AUTH } from "./auth.constants";
import { AuthController } from "./auth.controller";

@Module({
  imports: [EmailModule],
  providers: [
    {
      provide: AUTH,
      useFactory: (db: Db, config: ConfigService, email: EmailService) => {
        const appUrl = config.get<string>("APP_URL") ?? "http://localhost:5173";

        return betterAuth({
          secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
          baseURL: config.getOrThrow<string>("BETTER_AUTH_URL"),
          trustedOrigins: config
            .getOrThrow<string>("CORS_ALLOWED_ORIGINS")
            .split(","),
          database: drizzleAdapter(db, {
            provider: "pg",
            schema,
          }),
          advanced: {
            cookiePrefix: "orbit",
          },

          // --- better-auth native email hooks ---

          emailVerification: {
            sendVerificationEmail: async ({ user, url }) => {
              void email.sendVerifyEmail(user.email, user.name, url);
            },
            afterEmailVerification: async (user) => {
              void email.sendWelcome(user.email, user.name);
            },
          },

          emailAndPassword: {
            enabled: true,
            requireEmailVerification: true,
            sendResetPassword: async ({ user, url }) => {
              void email.sendResetPassword(user.email, user.name, url);
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

              // better-auth native invitation hook
              sendInvitationEmail: async (data) => {
                void email.sendInvitation(data.email, {
                  inviterName: data.inviter.user.name,
                  organizationName: data.organization.name,
                  inviteUrl: `${appUrl}/invite/${data.id}`,
                });
              },

              organizationHooks: {
                afterCreateOrganization: async ({ organization: org, user: owner }) => {
                  void email.sendWorkspaceCreated(owner.email, {
                    ownerName: owner.name,
                    organizationName: org.name,
                    workspaceUrl: `${appUrl}/${org.slug}`,
                  });
                },

                afterAcceptInvitation: async ({ invitation, user: newMember, organization: org }) => {
                  const inviter = await db.query.user.findFirst({
                    where: (u, { eq }) => eq(u.id, invitation.inviterId),
                  });
                  if (inviter) {
                    void email.sendMemberJoined(inviter.email, {
                      newMemberName: newMember.name,
                      newMemberEmail: newMember.email,
                      organizationName: org.name,
                      workspaceUrl: `${appUrl}/${org.slug}`,
                    });
                  }
                },

                beforeCreateInvitation: async () => {},
                beforeAcceptInvitation: async () => {},
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
                afterDeleteTeam: async () => {},
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
              },
            }),
          ],
        });
      },
      inject: [DB, ConfigService, EmailService],
    },
  ],
  controllers: [AuthController],
  exports: [AUTH],
})
export class AuthModule {}
```

> **Note:** Email sends use `void` (fire-and-forget) per better-auth's recommendation to avoid timing attacks and prevent email failures from blocking auth responses.
>
> **Note on hook signatures:** If TypeScript complains about hook argument shapes, check types in `node_modules/better-auth/dist` and adjust destructuring to match.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors. Fix any hook argument type mismatches by inspecting better-auth's exported types.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/auth/auth.module.ts
git commit -m "feat(email): wire all transactional emails via better-auth hooks and Resend"
```

---

## Task 5: Smoke test via Resend dashboard

**No new files** — manual verification only.

- [ ] **Step 1: Start the API**

```bash
pnpm dev
```

- [ ] **Step 2: Verify email verification flow**

1. Register a new account on `http://localhost:5173`
2. Resend dashboard → "Verify your Orbit email address" email should appear with a verify link
3. Click the verify link
4. Resend dashboard → "Welcome to Orbit!" email should appear

- [ ] **Step 3: Verify password reset flow**

1. On the login page, click "Forgot password" and submit an email
2. Resend dashboard → "Reset your Orbit password" email should appear with a reset link

- [ ] **Step 4: Verify workspace creation email**

1. After verifying, create a new workspace
2. Resend dashboard → "Your Orbit workspace … is ready" email should appear

- [ ] **Step 5: Verify invitation flow**

1. In workspace settings, invite a team member (use `delivered@resend.dev` to avoid hitting a real inbox)
2. Resend dashboard → invitation email with accept link should appear
3. Accept the invitation
4. Resend dashboard → "member joined" notification to the inviter should appear

- [ ] **Step 6: Commit any fixes**

```bash
git add -p
git commit -m "fix(email): adjust hook signatures after smoke test"
```

---

## Self-Review

### Spec coverage

| Requirement | Hook | Method |
|-------------|------|--------|
| Email verification on signup | `emailVerification.sendVerificationEmail` (native) | `sendVerifyEmail` |
| Welcome after verification | `emailVerification.afterEmailVerification` (native) | `sendWelcome` |
| Password reset | `emailAndPassword.sendResetPassword` (native) | `sendResetPassword` |
| Invite member | `organization.sendInvitationEmail` (native) | `sendInvitation` |
| Workspace created | `organizationHooks.afterCreateOrganization` (custom) | `sendWorkspaceCreated` |
| Inviter notified on join | `organizationHooks.afterAcceptInvitation` (custom) | `sendMemberJoined` |

### Placeholder scan

No TBDs or TODOs. Hook signature caveat called out with concrete resolution path.

### Type consistency

- All template data interfaces defined in Task 2, imported correctly in Tasks 3 and 4.
- `EmailService` method signatures match between definition (Task 3) and call sites (Task 4).
- `sendVerifyEmail(to, name, url)` and `sendResetPassword(to, name, url)` signatures consistent across test, service, and hook wiring.
