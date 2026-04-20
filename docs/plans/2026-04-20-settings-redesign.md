# Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Profile, Workspace, and Members settings pages around a small Linear-style primitive layer (`SettingsPage`, `SettingsSection`, `SettingsRow`) with inline-save-on-blur, wire Profile mutations to better-auth, and collapse the duplicate `general`/`workspace` routes.

**Architecture:** Introduce three small layout primitives that every settings page consumes. Each row owns its own mutation + save indicator — the page has no global "Save" button. Destructive flows open a confirm dialog. No image-upload infra — avatar and logo accept a URL string only. All content stays inside the existing workspace shell (AppNav + AppSidebar + content).

**Tech Stack:** React 19, TanStack Router (file-based), TanStack Query, `@tanstack/react-form`, Vitest, shadcn-style components (`@orbit/ui`), better-auth (`emailAndPassword` + `organization` plugin), Drizzle ORM.

**Spec:** [docs/superpowers/specs/2026-04-20-settings-redesign-design.md](docs/superpowers/specs/2026-04-20-settings-redesign-design.md)

---

## Task 1: Enable better-auth `deleteUser` on the API server

Profile's "Delete account" row calls `authClient.deleteUser()`. Better-auth requires explicit opt-in via the `user.deleteUser.enabled` server config — it's off by default and will 404 without this.

**Files:**
- Modify: `apps/api/src/auth/auth.module.ts`

**Step 1: Add `user.deleteUser.enabled` to the betterAuth config**

In the `betterAuth({...})` call, add at the top level (alongside `emailAndPassword`):

```ts
user: {
  deleteUser: { enabled: true },
},
```

**Step 2: Typecheck**

Run: `pnpm --filter api typecheck`
Expected: no errors related to the change.

**Step 3: Manual smoke test**

Run: `pnpm dev`
- Hit any route — server should boot without better-auth init errors.
- `POST /auth/delete-user` should respond (not 404) when authenticated.

**Step 4: Commit**

```bash
git add apps/api/src/auth/auth.module.ts
git commit -m "feat(auth): enable better-auth deleteUser endpoint"
```

---

## Task 2: Add `useUpdateUser` + `useDeleteAccount` auth hooks

Give the frontend typed mutations for the two new user operations. These belong next to the existing org hooks in `use-auth.tsx`.

**Files:**
- Modify: `apps/web/src/hooks/use-auth.tsx`

**Step 1: Add `useUpdateUser`**

After `useSetActiveOrganization` (search for it), add:

```ts
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; image?: string | null }) => {
      const { data, error } = await authClient.updateUser(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.session });
    },
  });2
}
```

**Step 2: Add `useDeleteAccount`**

Right below `useUpdateUser`:

```ts
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.deleteUser();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}
```

**Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no new errors.

**Step 4: Commit**

```bash
git add apps/web/src/hooks/use-auth.tsx
git commit -m "feat(web): add useUpdateUser and useDeleteAccount hooks"
```

---

## Task 3: Lift `useSaveIndicator` into a shared hook

Currently defined inside [general-settings.tsx](apps/web/src/components/workspace/settings/general-settings.tsx). Extract it so every row can reuse it.

**Files:**
- Create: `apps/web/src/components/workspace/settings/use-save-indicator.ts`
- Create: `apps/web/src/components/workspace/settings/use-save-indicator.test.ts`

**Step 1: Write the test (failing)**

`use-save-indicator.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSaveIndicator } from "./use-save-indicator";

describe("useSaveIndicator", () => {
  it("starts false", () => {
    const { result } = renderHook(() => useSaveIndicator());
    expect(result.current.saved).toBe(false);
  });

  it("flips to true on trigger then back to false after timeout", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.trigger());
    expect(result.current.saved).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.saved).toBe(false);
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests, expect fail**

Run: `cd apps/web && pnpm test use-save-indicator`
Expected: Cannot find module.

**Step 3: Implement**

`use-save-indicator.ts`:

```ts
import { useCallback, useRef, useState } from "react";

export function useSaveIndicator(durationMs = 1500) {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = useCallback(() => {
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), durationMs);
  }, [durationMs]);
  return { saved, trigger };
}
```

**Step 4: Run tests, expect pass**

Run: `cd apps/web && pnpm test use-save-indicator`
Expected: 2 passed.

**Step 5: Commit**

```bash
git add apps/web/src/components/workspace/settings/use-save-indicator.ts apps/web/src/components/workspace/settings/use-save-indicator.test.ts
git commit -m "feat(settings): extract useSaveIndicator hook with tests"
```

---

## Task 4: Build `SettingsPage` primitive

**Files:**
- Create: `apps/web/src/components/workspace/settings/settings-page.tsx`

**Step 1: Implement**

```tsx
import type { ReactNode } from "react";

export function SettingsPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="space-y-10">{children}</div>
    </div>
  );
}
```

**Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no new errors.

**Step 3: Commit**

```bash
git add apps/web/src/components/workspace/settings/settings-page.tsx
git commit -m "feat(settings): add SettingsPage primitive"
```

---

## Task 5: Build `SettingsSection` primitive

**Files:**
- Create: `apps/web/src/components/workspace/settings/settings-section.tsx`

**Step 1: Implement**

```tsx
import { cn } from "@orbit/ui/lib/utils";
import type { ReactNode } from "react";

export function SettingsSection({
  heading,
  tone = "default",
  children,
}: {
  heading?: string;
  tone?: "default" | "destructive";
  children: ReactNode;
}) {
  return (
    <section>
      {heading && (
        <h2
          className={cn(
            "mb-2 text-xs font-semibold uppercase tracking-wide",
            tone === "destructive"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {heading}
        </h2>
      )}
      <div
        className={cn(
          "rounded-lg border bg-card",
          tone === "destructive" && "border-destructive/30",
        )}
      >
        {children}
      </div>
    </section>
  );
}
```

**Step 2: Typecheck**

Run: `pnpm --filter web typecheck`

**Step 3: Commit**

```bash
git add apps/web/src/components/workspace/settings/settings-section.tsx
git commit -m "feat(settings): add SettingsSection primitive"
```

---

## Task 6: Build `SettingsRow` primitive with tests

`SettingsRow` is the atom of the new design: label/hint on the left, control slot on the right, flat divider between rows. It also exposes an ephemeral "Saved ✓" indicator absolutely positioned in the control area.

**Files:**
- Create: `apps/web/src/components/workspace/settings/settings-row.tsx`
- Create: `apps/web/src/components/workspace/settings/settings-row.test.tsx`

**Step 1: Write the test (failing)**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow } from "./settings-row";

describe("SettingsRow", () => {
  it("renders label, hint, and control", () => {
    render(
      <SettingsRow label="Name" hint="Your name">
        <input data-testid="name-input" />
      </SettingsRow>,
    );
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Your name")).toBeDefined();
    expect(screen.getByTestId("name-input")).toBeDefined();
  });

  it("shows Saved indicator when saved prop is true", () => {
    render(
      <SettingsRow label="Name" saved>
        <input />
      </SettingsRow>,
    );
    expect(screen.getByText(/saved/i)).toBeDefined();
  });

  it("hides Saved indicator when saved is false", () => {
    render(
      <SettingsRow label="Name">
        <input />
      </SettingsRow>,
    );
    expect(screen.queryByText(/saved/i)).toBeNull();
  });
});
```

**Step 2: Run tests, expect fail**

Run: `cd apps/web && pnpm test settings-row`
Expected: Cannot find module.

**Step 3: Implement**

```tsx
import { cn } from "@orbit/ui/lib/utils";
import type { ReactNode } from "react";

export function SettingsRow({
  label,
  hint,
  saved = false,
  last = false,
  children,
}: {
  label: string;
  hint?: string;
  saved?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-10 px-5 py-4",
        !last && "border-b",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="relative w-[280px] shrink-0">
        {children}
        {saved && (
          <span
            className="pointer-events-none absolute -bottom-4 right-0 text-[10px] font-medium text-green-500"
            aria-live="polite"
          >
            Saved ✓
          </span>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run tests, expect pass**

Run: `cd apps/web && pnpm test settings-row`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add apps/web/src/components/workspace/settings/settings-row.tsx apps/web/src/components/workspace/settings/settings-row.test.tsx
git commit -m "feat(settings): add SettingsRow primitive with tests"
```

---

## Task 7: Delete the orphan `general.tsx` route

It's dead code — the sidebar points at `/settings/workspace` and no UI links to `/settings/general`.

**Files:**
- Delete: `apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx`

**Step 1: Delete**

Run: `rm apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx`

**Step 2: Typecheck** (routeTree.gen.ts regens on dev; a cold typecheck may complain — if so, run the app once to regen, then retypecheck)

Run: `pnpm --filter web typecheck`
If errors about `/settings/general` exist, first run `pnpm --filter web dev` briefly to let TanStack regen the tree, then retypecheck.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(settings): remove orphan general.tsx route"
```

---

## Task 8: Build `DeleteAccountDialog`

Confirmation dialog gated by typing the user's email.

**Files:**
- Create: `apps/web/src/components/workspace/settings/delete-account-dialog.tsx`

**Step 1: Implement**

```tsx
import { Button } from "@orbit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orbit/ui/components/dialog";
import { Input } from "@orbit/ui/components/input";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useDeleteAccount } from "@/hooks/use-auth";

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}) {
  const router = useRouter();
  const deleteAccount = useDeleteAccount();
  const [confirm, setConfirm] = useState("");
  const canDelete = confirm === userEmail && !deleteAccount.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and all data. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Type <strong>{userEmail}</strong> to confirm.
        </p>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={userEmail}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={() =>
              deleteAccount.mutate(undefined, {
                onSuccess: () => router.navigate({ to: "/" }),
              })
            }
          >
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Typecheck**

Run: `pnpm --filter web typecheck`

**Step 3: Commit**

```bash
git add apps/web/src/components/workspace/settings/delete-account-dialog.tsx
git commit -m "feat(settings): add DeleteAccountDialog"
```

---

## Task 9: Build `ProfileSettings` component

Uses primitives + `useUpdateUser`. Avatar is a URL-only input with a live `UserAvatar` preview. Email is read-only.

**Files:**
- Create: `apps/web/src/components/workspace/settings/profile-settings.tsx`
- Create: `apps/web/src/components/workspace/settings/profile-settings.test.tsx`

**Step 1: Write the test (failing)**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProfileSettings } from "./profile-settings";

vi.mock("@/hooks/use-auth", () => ({
  useSession: () => ({
    data: { user: { name: "Thinh", email: "t@x.com", image: null } },
  }),
  useUpdateUser: () => ({ mutate: updateMock, isPending: false }),
  useDeleteAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));

const updateMock = vi.fn();

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

describe("ProfileSettings", () => {
  beforeEach(() => updateMock.mockClear());

  it("fires updateUser when name changes on blur", () => {
    wrap(<ProfileSettings />);
    const input = screen.getByDisplayValue("Thinh") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Thinh Le" } });
    fireEvent.blur(input);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Thinh Le" }),
      expect.any(Object),
    );
  });

  it("does not fire updateUser when value is unchanged", () => {
    wrap(<ProfileSettings />);
    const input = screen.getByDisplayValue("Thinh") as HTMLInputElement;
    fireEvent.blur(input);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests, expect fail**

Run: `cd apps/web && pnpm test profile-settings`
Expected: Cannot find module.

**Step 3: Implement**

```tsx
import { Badge } from "@orbit/ui/components/badge";
import { Button } from "@orbit/ui/components/button";
import { Input } from "@orbit/ui/components/input";
import { useState } from "react";
import { UserAvatar } from "@/components/common/user-avatar";
import { useSession, useUpdateUser } from "@/hooks/use-auth";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { SettingsPage } from "./settings-page";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";
import { useSaveIndicator } from "./use-save-indicator";

export function ProfileSettings() {
  const { data: session } = useSession();
  const update = useUpdateUser();
  const nameSave = useSaveIndicator();
  const avatarSave = useSaveIndicator();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const user = session?.user;
  if (!user) return null;

  function saveIf<K extends "name" | "image">(
    field: K,
    value: string,
    prev: string | null | undefined,
    indicator: ReturnType<typeof useSaveIndicator>,
  ) {
    const next = value.trim();
    const prevTrimmed = (prev ?? "").trim();
    if (next === prevTrimmed) return;
    update.mutate(
      { [field]: next || null } as { name?: string; image?: string | null },
      { onSuccess: indicator.trigger },
    );
  }

  return (
    <SettingsPage
      title="Profile"
      subtitle="Personal info visible across Orbit."
    >
      <SettingsSection>
        <SettingsRow
          label="Avatar"
          hint="Paste an image URL. Upload is coming later."
          saved={avatarSave.saved}
        >
          <div className="flex items-center gap-2">
            <UserAvatar name={user.name} image={user.image} size="sm" />
            <Input
              defaultValue={user.image ?? ""}
              placeholder="https://…"
              onBlur={(e) =>
                saveIf("image", e.target.value, user.image, avatarSave)
              }
            />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Full name"
          hint="Shown everywhere you appear."
          saved={nameSave.saved}
        >
          <Input
            defaultValue={user.name ?? ""}
            onBlur={(e) => saveIf("name", e.target.value, user.name, nameSave)}
          />
        </SettingsRow>
        <SettingsRow label="Email" hint="Contact your admin to change." last>
          <div className="flex items-center gap-2">
            <Input defaultValue={user.email} disabled />
            <Badge variant="secondary">Verified</Badge>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection heading="Danger zone" tone="destructive">
        <SettingsRow
          label="Delete account"
          hint="Permanently delete your account and data."
          last
        >
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </SettingsRow>
      </SettingsSection>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        userEmail={user.email}
      />
    </SettingsPage>
  );
}
```

**Step 4: Run tests, expect pass**

Run: `cd apps/web && pnpm test profile-settings`
Expected: 2 passed.

**Step 5: Commit**

```bash
git add apps/web/src/components/workspace/settings/profile-settings.tsx apps/web/src/components/workspace/settings/profile-settings.test.tsx
git commit -m "feat(settings): add ProfileSettings component"
```

---

## Task 10: Wire `/settings/profile` route to `ProfileSettings`

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/profile.tsx`

**Step 1: Replace contents**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/workspace/settings/profile-settings";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/profile")({
  component: ProfileSettings,
});
```

**Step 2: Manual test**

Run: `pnpm dev`
- Navigate to `/<orgSlug>/settings/profile` → new UI renders.
- Change name, blur → "Saved ✓" appears → refresh → value persisted.
- Delete account button opens dialog; "Delete account" stays disabled until email is typed.

**Step 3: Commit**

```bash
git add apps/web/src/routes/_workspace/$orgSlug/settings/profile.tsx
git commit -m "feat(settings): wire profile route to ProfileSettings"
```

---

## Task 11: Rewrite `general-settings.tsx` onto the new primitives

Replace the ad-hoc `SettingsRow` / `useSaveIndicator` locals with imports from the new primitives. Convert logo from file-input stub → URL input matching the Profile avatar pattern. Danger zone becomes a destructive `SettingsSection`. Transfer ownership stays disabled.

**Files:**
- Modify: `apps/web/src/components/workspace/settings/general-settings.tsx`

**Step 1: Replace file contents**

```tsx
import { Button } from "@orbit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orbit/ui/components/dialog";
import { Input } from "@orbit/ui/components/input";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { OrgAvatar } from "@/components/common/org-avatar";
import { useDeleteOrganization, useUpdateOrganization } from "@/hooks/use-auth";
import { SettingsPage } from "./settings-page";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";
import { useSaveIndicator } from "./use-save-indicator";

interface GeneralSettingsProps {
  org: { id: string; name: string; slug: string; logo?: string | null };
  isOwner: boolean;
}

export function GeneralSettings({ org, isOwner }: GeneralSettingsProps) {
  const router = useRouter();
  const update = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const nameSave = useSaveIndicator();
  const slugSave = useSaveIndicator();
  const logoSave = useSaveIndicator();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function saveIf(
    field: "name" | "slug" | "logo",
    value: string,
    prev: string | null | undefined,
    indicator: ReturnType<typeof useSaveIndicator>,
  ) {
    const next = value.trim();
    const prevTrimmed = (prev ?? "").trim();
    if (next === prevTrimmed) return;
    update.mutate(
      {
        organizationId: org.id,
        data: { [field]: field === "logo" ? next || null : next },
      },
      { onSuccess: indicator.trigger },
    );
  }

  const canDelete = deleteConfirm === org.name && !deleteOrg.isPending;

  return (
    <SettingsPage
      title="Workspace"
      subtitle="Manage your workspace name, URL, and logo."
    >
      <SettingsSection>
        <SettingsRow
          label="Logo"
          hint="Paste an image URL. Upload is coming later."
          saved={logoSave.saved}
        >
          <div className="flex items-center gap-2">
            <OrgAvatar name={org.name} logo={org.logo} size="sm" />
            <Input
              defaultValue={org.logo ?? ""}
              placeholder="https://…"
              onBlur={(e) => saveIf("logo", e.target.value, org.logo, logoSave)}
            />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Workspace name"
          hint="Displayed across the app."
          saved={nameSave.saved}
        >
          <Input
            defaultValue={org.name}
            onBlur={(e) => saveIf("name", e.target.value, org.name, nameSave)}
          />
        </SettingsRow>
        <SettingsRow
          label="URL slug"
          hint="Changing invalidates existing links."
          saved={slugSave.saved}
          last
        >
          <div className="flex">
            <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
              orbit.app/
            </span>
            <Input
              className="rounded-l-none"
              defaultValue={org.slug}
              onBlur={(e) => saveIf("slug", e.target.value, org.slug, slugSave)}
            />
          </div>
        </SettingsRow>
      </SettingsSection>

      {isOwner && (
        <SettingsSection heading="Danger zone" tone="destructive">
          <SettingsRow
            label="Transfer ownership"
            hint="Assign Owner to another member. You become Admin."
          >
            <Button variant="outline" disabled>
              Transfer
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Delete workspace"
            hint="Permanently delete this workspace and all its data."
            last
          >
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete workspace
            </Button>
          </SettingsRow>
        </SettingsSection>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              This permanently deletes the workspace and all its data.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Type <strong>{org.name}</strong> to confirm.
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={org.name}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canDelete}
              onClick={() =>
                deleteOrg.mutate(org.id, {
                  onSuccess: () => router.navigate({ to: "/" }),
                })
              }
            >
              Delete workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  );
}
```

**Step 2: Typecheck**

Run: `pnpm --filter web typecheck`

**Step 3: Manual test**

`pnpm dev` → `/settings/workspace`:
- Change name / slug / logo URL → Saved indicator.
- Non-owner: no danger zone.
- Owner: delete dialog disables the destructive button until the name is typed.

**Step 4: Commit**

```bash
git add apps/web/src/components/workspace/settings/general-settings.tsx
git commit -m "refactor(settings): rewrite GeneralSettings on new primitives"
```

---

## Task 12: Refactor `MembersTable` page to new primitives

Members page wraps content in `SettingsPage`. Table styling stays close to current, but section frames come from `SettingsSection`. Replaces the page's own `div > h1 …` header.

**Files:**
- Modify: `apps/web/src/components/workspace/settings/members-table.tsx`
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/members.tsx`

**Step 1: Update `members-table.tsx`**

Wrap the existing returned JSX in `<SettingsPage title="Members" subtitle="Manage who has access to this workspace.">`. Replace the two existing `rounded-lg border bg-card` wrappers around the active-member and pending-invitation tables with `<SettingsSection heading="Active members">` and `<SettingsSection heading="Pending invitations">` — drop the internal header bars (section `heading` replaces them).

- Keep the filter toolbar (search + role filter) but move it outside `SettingsSection` and just above the "Active members" section.
- Keep existing `Table`/`TableRow` content unchanged inside the sections.

Do NOT touch the `InviteMemberModal` prop or the hooks wiring.

**Step 2: Update `members.tsx` route**

Simplify — the page wrapper now lives inside `MembersTable`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { InviteMemberModal } from "@/components/workspace/settings/invite-member-modal";
import { MembersTable } from "@/components/workspace/settings/members-table";
import { useOrgMembers, useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/members")({
  component: MembersPage,
});

function MembersPage() {
  const { targetOrg } = Route.useRouteContext() as any;
  const { data: org, isLoading } = useOrgMembers(targetOrg.id);
  const { data: session } = useSession();

  if (isLoading || !org || !session) return null;

  const currentMember = org.members?.find(
    (m: any) => m.userId === session.user.id,
  );
  const currentRole = currentMember?.role ?? "member";

  return (
    <MembersTable
      members={org.members ?? []}
      invitations={(org.invitations ?? []).filter(
        (i: any) => i.status === "pending",
      )}
      organizationId={targetOrg.id}
      currentUserId={session.user.id}
      currentRole={currentRole}
      inviteSlot={<InviteMemberModal organizationId={targetOrg.id} />}
    />
  );
}
```

Then in `members-table.tsx`, accept `inviteSlot?: React.ReactNode` prop and render it right of the page title. Use a flex row inside `SettingsPage` for the header + invite button.

**Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

**Step 4: Manual test**

`pnpm dev` → `/settings/members`:
- Table renders, search/role filter still works.
- Invite button opens modal.
- Pending invitations section only appears when there are pending invites.
- Non-admin user: no row action menu.

**Step 5: Commit**

```bash
git add apps/web/src/components/workspace/settings/members-table.tsx apps/web/src/routes/_workspace/$orgSlug/settings/members.tsx
git commit -m "refactor(settings): rewrite MembersTable on new primitives"
```

---

## Task 13: Stub `/settings/notifications` and `/settings/billing`

Both pages get the same "Coming soon" card inside a `SettingsPage`. Delete the now-unused `billing-settings.tsx` component.

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/notifications.tsx`
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings/billing.tsx`
- Delete: `apps/web/src/components/workspace/settings/billing-settings.tsx`

**Step 1: Update `notifications.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/workspace/settings/settings-page";

export const Route = createFileRoute(
  "/_workspace/$orgSlug/settings/notifications",
)({
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <SettingsPage
      title="Notifications"
      subtitle="Control how Orbit reaches out to you."
    >
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Coming soon.
      </div>
    </SettingsPage>
  );
}
```

**Step 2: Update `billing.tsx`**

Same shape, title "Billing", subtitle "Manage your plan and invoices."

**Step 3: Delete old billing-settings component**

Run: `rm apps/web/src/components/workspace/settings/billing-settings.tsx`

**Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors (no other file imports `billing-settings`).

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(settings): stub notifications and billing pages"
```

---

## Task 14: Final verification

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: only the pre-existing `packages/ui/src/components/sidebar.tsx` errors (unrelated). No new errors.

**Step 2: Full lint**

Run: `pnpm check`
Expected: clean.

**Step 3: Full test run**

Run: `cd apps/web && pnpm test`
Expected: all new tests pass, existing tests pass.

**Step 4: End-to-end manual smoke**

Start dev: `pnpm dev`. Visit:
- `/<orgSlug>/settings` → redirects to `/settings/profile`.
- `/settings/profile` → edit name, see Saved ✓, reload → persisted.
- `/settings/profile` → paste a URL into Avatar → avatar preview updates on save.
- `/settings/workspace` → same flow for name / slug / logo URL.
- `/settings/workspace` → delete dialog requires typing org name.
- `/settings/members` → search, filter, invite, role change, remove.
- `/settings/notifications` and `/settings/billing` → Coming soon cards.
- Sidebar highlights active item via the existing `useMatchRoute` wiring.

**Step 5: Final commit (if any fix-ups)**

```bash
git add -A
git commit -m "chore(settings): verification pass"
```

---

## Notes for the executor

- The spec says **no page-level Save buttons**. If you find one in a route file or component, remove it — everything saves on blur.
- All `authClient.updateUser({ image })` and `useUpdateOrganization({ data: { logo } })` calls must pass `null` (not empty string) when the user clears the field — otherwise the avatar/logo stays as an empty string in the DB and the fallback logic breaks.
- `SettingsRow` width is fixed at `w-[280px]`; don't override it per-row unless a field genuinely needs more (e.g., wide invite input — in that case drop `SettingsRow` and render the table/toolbar directly inside `SettingsSection`).
- Tests are colocated with components (not under a `__tests__/` folder) — match the existing convention.
- Do NOT touch `routeTree.gen.ts`.
