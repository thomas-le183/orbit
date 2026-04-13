# Settings — Admin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat settings layout with a sidebar-nav shell and build the General and Members admin pages.

**Architecture:** Settings routes stay at `/$orgSlug/settings/*`. A new `SettingsSidebar` component renders inside the settings layout shell alongside the `<Outlet>`. Role-gating hides the Workspace section for plain members. Most mutations already exist in `use-auth.tsx`; the only new backend work is a `GET /presence` endpoint for Last seen data.

**Tech Stack:** React 19, TanStack Router (file-based), TanStack Query, better-auth `organizationClient`, Tailwind CSS v4, `@orbit/ui` component primitives, NestJS + Drizzle ORM.

---

## Task 1: Add `useOrgMembers` and `useOrgRole` hooks

**Files:**
- Modify: `apps/web/src/hooks/use-auth.tsx`

### Step 1: Add the hooks after the existing `useUpdateMemberRole` hook

Append to `apps/web/src/hooks/use-auth.tsx`:

```ts
export function useOrgMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["auth", "org-full", organizationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.getFullOrganization({
        query: { organizationId: organizationId! },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useOrgRole(organizationId: string | undefined) {
  const { data: session } = useSession();
  const { data: org } = useOrgMembers(organizationId);
  const currentUserId = session?.user?.id;
  const member = org?.members?.find((m) => m.userId === currentUserId);
  return member?.role ?? null;
}
```

### Step 2: Run type-check

```bash
npm run check-types
```

Expected: no errors in `use-auth.tsx`.

### Step 3: Commit

```bash
git add apps/web/src/hooks/use-auth.tsx
git commit -m "feat(settings): add useOrgMembers and useOrgRole hooks"
```

---

## Task 2: Create `SettingsSidebar` component

**Files:**
- Create: `apps/web/src/components/workspace/settings-sidebar.tsx`

### Step 1: Create the component

```tsx
// apps/web/src/components/workspace/settings-sidebar.tsx
import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams, useRouterState } from "@tanstack/react-router";

interface NavItem {
  label: string;
  to: string;
}

const accountItems: NavItem[] = [
  { label: "Profile", to: "profile" },
  { label: "Notifications", to: "notifications" },
];

const workspaceItems: NavItem[] = [
  { label: "General", to: "general" },
  { label: "Members", to: "members" },
  { label: "Billing", to: "billing" },
];

const itemClass = cn(
  "block rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/60",
  "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  "[&.active]:bg-sidebar-active [&.active]:text-sidebar-accent-foreground",
);

export function SettingsSidebar({ isAdmin }: { isAdmin: boolean }) {
  const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
  const base = `/${orgSlug}/settings`;

  return (
    <div className="flex h-full w-[210px] shrink-0 flex-col border-r bg-sidebar py-5">
      <nav className="flex flex-col gap-4 px-3">
        <div>
          <p className="mb-1 px-3 text-[11px] font-medium text-sidebar-foreground/40">
            Account
          </p>
          <div className="flex flex-col gap-0.5">
            {accountItems.map((item) => (
              <Link
                key={item.to}
                to={`${base}/${item.to}`}
                className={itemClass}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="mb-1 px-3 text-[11px] font-medium text-sidebar-foreground/40">
              Workspace
            </p>
            <div className="flex flex-col gap-0.5">
              {workspaceItems.map((item) => (
                <Link
                  key={item.to}
                  to={`${base}/${item.to}`}
                  className={itemClass}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
```

### Step 2: Run type-check

```bash
npm run check-types
```

Expected: no errors.

### Step 3: Commit

```bash
git add apps/web/src/components/workspace/settings-sidebar.tsx
git commit -m "feat(settings): add SettingsSidebar component"
```

---

## Task 3: Replace settings shell with sidebar layout

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings.tsx`

### Step 1: Rewrite the layout

The settings shell renders inside `<main className="h-full overflow-auto p-6">` from `$orgSlug.tsx`. Use `-m-6 min-h-[calc(100%+3rem)]` to break out of the parent padding and fill edge-to-edge.

```tsx
// apps/web/src/routes/_workspace/$orgSlug/settings.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SettingsSidebar } from "@/components/workspace/settings-sidebar";
import { useOrgRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { targetOrg } = Route.useRouteContext();
  const role = useOrgRole(targetOrg.id);
  const isAdmin = role === "admin" || role === "owner";

  return (
    <div className="-m-6 flex min-h-[calc(100%+3rem)]">
      <SettingsSidebar isAdmin={isAdmin} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-12 py-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Start dev server and verify

```bash
npm run dev
```

Navigate to `/<orgSlug>/settings/profile`. The sidebar should appear on the left with Profile and Notifications under Account. If you're admin/owner, General, Members, Billing appear under Workspace. The existing Profile and Notifications content renders in the right panel.

### Step 3: Commit

```bash
git add apps/web/src/routes/_workspace/$orgSlug/settings.tsx
git commit -m "feat(settings): replace settings shell with sidebar layout"
```

---

## Task 4: Add settings index redirect

**Files:**
- Modify: `apps/web/src/routes/_workspace/$orgSlug/settings.tsx`

### Step 1: Add `beforeLoad` redirect to the route definition

TanStack Router needs the index to redirect. Add `beforeLoad` to the existing route:

```tsx
export const Route = createFileRoute("/_workspace/$orgSlug/settings")({
  beforeLoad: ({ location, params }) => {
    // Redirect bare /settings to /settings/profile
    if (location.pathname === `/${params.orgSlug}/settings` ||
        location.pathname === `/${params.orgSlug}/settings/`) {
      throw redirect({ to: "/$orgSlug/settings/profile", params });
    }
  },
  component: SettingsLayout,
});
```

### Step 2: Verify redirect

Navigate to `/<orgSlug>/settings`. Should immediately land on `/settings/profile`.

### Step 3: Commit

```bash
git add apps/web/src/routes/_workspace/$orgSlug/settings.tsx
git commit -m "feat(settings): redirect /settings index to /settings/profile"
```

---

## Task 5: General settings page

**Files:**
- Create: `apps/web/src/components/workspace/general-settings.tsx`
- Create: `apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx`

### Step 1: Create the `GeneralSettings` component

```tsx
// apps/web/src/components/workspace/general-settings.tsx
import { Button } from "@orbit/ui/components/button";
import { Input } from "@orbit/ui/components/input";
import { cn } from "@orbit/ui/lib/utils";
import { useCallback, useRef, useState } from "react";
import { useDeleteOrganization, useUpdateOrganization } from "@/hooks/use-auth";

interface GeneralSettingsProps {
  org: { id: string; name: string; slug: string; logo?: string | null };
  isOwner: boolean;
}

// Row: label on left, input/control on right, divider below
function SettingsRow({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-10 py-4",
        !last && "border-b",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="w-[280px] shrink-0">{children}</div>
    </div>
  );
}

// Inline save feedback: shows "Saved" for 2s after mutation
function useSaveIndicator() {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = useCallback(() => {
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  }, []);
  return { saved, trigger };
}

export function GeneralSettings({ org, isOwner }: GeneralSettingsProps) {
  const update = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const nameSave = useSaveIndicator();
  const slugSave = useSaveIndicator();
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleBlur(
    field: "name" | "slug",
    value: string,
    indicator: ReturnType<typeof useSaveIndicator>,
  ) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === org[field]) return;
    update.mutate(
      { organizationId: org.id, data: { [field]: trimmed } },
      { onSuccess: indicator.trigger },
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">General</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Manage your workspace name, URL, and appearance.
      </p>

      {/* Main card */}
      <div className="rounded-lg border bg-card px-5">
        <SettingsRow
          label="Workspace name"
          hint="Displayed across the app and in email notifications."
        >
          <div className="relative">
            <Input
              defaultValue={org.name}
              onBlur={(e) => handleBlur("name", e.target.value, nameSave)}
            />
            {nameSave.saved && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-green-500">
                Saved ✓
              </span>
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          label="URL slug"
          hint="Used in all workspace URLs. Changing it will invalidate existing links."
        >
          <div className="relative flex">
            <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
              orbit.app/
            </span>
            <Input
              className="rounded-l-none"
              defaultValue={org.slug}
              onBlur={(e) => handleBlur("slug", e.target.value, slugSave)}
            />
            {slugSave.saved && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-green-500">
                Saved ✓
              </span>
            )}
          </div>
        </SettingsRow>

        <SettingsRow label="Logo" hint="PNG or JPG · max 2 MB." last>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted text-lg font-bold text-primary">
              {org.logo ? (
                <img
                  src={org.logo}
                  alt="Logo"
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                org.name[0]?.toUpperCase()
              )}
            </div>
            <Button variant="outline" size="sm" disabled>
              Upload logo
            </Button>
          </div>
        </SettingsRow>
      </div>

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="mt-10">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Danger zone
          </p>
          <div className="rounded-lg border bg-card">
            {/* Transfer ownership row */}
            <div className="flex items-center justify-between gap-6 border-b p-4">
              <div>
                <p className="text-sm font-medium">Transfer ownership</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Assign the Owner role to another member. You will become an Admin.
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" disabled>
                Transfer
              </Button>
            </div>

            {/* Delete workspace row */}
            <div className="flex items-center justify-between gap-6 p-4">
              <div>
                <p className="text-sm font-medium">Delete workspace</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Permanently delete this workspace and all its data.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete workspace
              </Button>
            </div>
          </div>

          {/* Inline confirmation (no extra modal dep yet) */}
          {showDeleteConfirm && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-2 text-sm text-destructive">
                Type <strong>{org.name}</strong> to confirm deletion.
              </p>
              <Input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={org.name}
                className="mb-3 max-w-[280px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteInput !== org.name || deleteOrg.isPending}
                  onClick={() => deleteOrg.mutate(org.id)}
                >
                  Confirm delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteInput("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Create the route file

```tsx
// apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx
import { createFileRoute } from "@tanstack/react-router";
import { GeneralSettings } from "@/components/workspace/general-settings";
import { useOrgRole, useOrganizations } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/general")({
  component: GeneralPage,
});

function GeneralPage() {
  const { targetOrg } = Route.useRouteContext();
  const { data: orgs } = useOrganizations();
  const org = orgs?.find((o) => o.id === targetOrg.id);
  const role = useOrgRole(targetOrg.id);
  const isOwner = role === "owner";

  if (!org) return null;

  return <GeneralSettings org={org} isOwner={isOwner} />;
}
```

### Step 3: Verify in browser

Navigate to `/<orgSlug>/settings/general`. The card should show workspace name, URL slug, logo rows. Edit the workspace name and tab away — "Saved ✓" should flash. Owner sees Danger zone; admin does not.

### Step 4: Run lint

```bash
npm run check
```

Fix any issues.

### Step 5: Commit

```bash
git add apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx \
        apps/web/src/components/workspace/general-settings.tsx
git commit -m "feat(settings): add General settings page with auto-save"
```

---

## Task 6: Backend — presence GET endpoint

**Files:**
- Modify: `apps/api/src/chat/presence/presence.service.ts`
- Modify: `apps/api/src/chat/presence/presence.controller.ts`

### Step 1: Add `getOrgPresence` to `PresenceService`

In `presence.service.ts`, add after `setOffline`:

```ts
async getOrgPresence(orgId: string) {
  return this.db.query.userPresence.findMany({
    where: eq(schema.userPresence.organizationId, orgId),
  });
}
```

(The `eq` import is already used in the file.)

### Step 2: Add `GET /presence` to `PresenceController`

Add after the existing `@Patch()` handler:

```ts
import { Get, /* existing imports */ } from "@nestjs/common";

@Get()
async getOrgPresence(@CurrentSession() session: Session) {
  if (!session.activeOrganizationId) {
    throw new ForbiddenException("No active organization");
  }
  return this.presenceService.getOrgPresence(session.activeOrganizationId);
}
```

### Step 3: Verify the endpoint

Start the API (`npm run dev`) and hit `GET /presence` with a valid session cookie. Should return an array of presence records.

### Step 4: Commit

```bash
git add apps/api/src/chat/presence/presence.service.ts \
        apps/api/src/chat/presence/presence.controller.ts
git commit -m "feat(presence): add GET /presence endpoint for org member presence"
```

---

## Task 7: Frontend — `useOrgPresence` hook

**Files:**
- Create: `apps/web/src/hooks/use-presence.ts`

### Step 1: Create the hook

```ts
// apps/web/src/hooks/use-presence.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface PresenceRecord {
  userId: string;
  organizationId: string;
  status: string;
  lastSeenAt: string | null;
  updatedAt: string;
}

export function useOrgPresence() {
  return useQuery({
    queryKey: ["presence", "org"],
    queryFn: async () => {
      const { data } = await api.get<PresenceRecord[]>("/presence");
      return data;
    },
    refetchInterval: 30_000, // refresh every 30s
  });
}

/** Returns a human-readable "last seen" string for a userId. */
export function formatLastSeen(presence: PresenceRecord | undefined): string {
  if (!presence) return "—";
  if (presence.status === "online") return "Online now";
  const ts = presence.lastSeenAt ?? presence.updatedAt;
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

### Step 2: Commit

```bash
git add apps/web/src/hooks/use-presence.ts
git commit -m "feat(presence): add useOrgPresence hook with formatLastSeen helper"
```

---

## Task 8: Invite member modal

**Files:**
- Create: `apps/web/src/components/workspace/invite-member-modal.tsx`

### Step 1: Create the component

Uses `Dialog` + `@tanstack/react-form` (project standard for forms).

```tsx
// apps/web/src/components/workspace/invite-member-modal.tsx
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from "@orbit/ui/components/dialog";
import { Button } from "@orbit/ui/components/button";
import { Input } from "@orbit/ui/components/input";
import { Field, FieldLabel } from "@orbit/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useInviteMember } from "@/hooks/use-auth";

const ROLES = ["member", "admin"] as const;
type InviteRole = (typeof ROLES)[number];

export function InviteMemberModal({
  organizationId,
}: {
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const invite = useInviteMember();

  const form = useForm({
    defaultValues: { email: "", role: "member" as InviteRole },
    onSubmit: async ({ value }) => {
      await invite.mutateAsync({
        organizationId,
        email: value.email,
        role: value.role,
      });
      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">Invite members</Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="w-full max-w-md p-6">
          <h2 className="mb-4 text-base font-semibold">Invite a member</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <form.Field name="email">
              {(field) => (
                <Field>
                  <FieldLabel>Email address</FieldLabel>
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="role">
              {(field) => (
                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <div className="flex gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => field.handleChange(r)}
                        className={`rounded-md border px-3 py-1.5 text-sm capitalize transition-colors ${
                          field.state.value === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            </form.Field>

            <div className="flex justify-end gap-2 pt-2">
              <DialogClose>
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={invite.isPending}>
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
```

### Step 2: Run type-check

```bash
npm run check-types
```

### Step 3: Commit

```bash
git add apps/web/src/components/workspace/invite-member-modal.tsx
git commit -m "feat(settings): add InviteMemberModal component"
```

---

## Task 9: Members page

**Files:**
- Create: `apps/web/src/components/workspace/members-table.tsx`
- Create: `apps/web/src/routes/_workspace/$orgSlug/settings/members.tsx`

### Step 1: Create `MembersTable` component

```tsx
// apps/web/src/components/workspace/members-table.tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orbit/ui/components/table";
import { Button } from "@orbit/ui/components/button";
import { cn } from "@orbit/ui/lib/utils";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { useRemoveMember, useUpdateMemberRole } from "@/hooks/use-auth";
import { formatLastSeen, useOrgPresence } from "@/hooks/use-presence";

type Member = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | string;
  user: { id: string; name: string; email: string; image?: string | null };
};

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date | string;
  inviterId: string;
};

const rolePillClass: Record<string, string> = {
  owner:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  member: "bg-muted text-muted-foreground border-border",
};

function RolePill({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize",
        rolePillClass[role] ?? rolePillClass.member,
      )}
    >
      {role}
    </span>
  );
}

function Avatar({
  name,
  image,
}: {
  name: string;
  image?: string | null;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
      {name[0]?.toUpperCase()}
    </div>
  );
}

export function MembersTable({
  members,
  invitations,
  organizationId,
  currentUserId,
  currentRole,
}: {
  members: Member[];
  invitations: Invitation[];
  organizationId: string;
  currentUserId: string;
  currentRole: string;
}) {
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();
  const { data: presenceList } = useOrgPresence();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const presenceMap = new Map(presenceList?.map((p) => [p.userId, p]));

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.user.name.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canManage = currentRole === "admin" || currentRole === "owner";

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-56 rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {members.length} member{members.length !== 1 ? "s" : ""}
          {invitations.length > 0 && ` · ${invitations.length} pending`}
        </span>
      </div>

      {/* Active members */}
      <div className="mb-5 rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            Active members
          </span>
          <span className="text-xs text-muted-foreground">{filtered.length}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[110px]">Joined</TableHead>
              <TableHead className="w-[130px]">Last seen</TableHead>
              <TableHead className="w-9" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const presence = presenceMap.get(m.userId);
              const isYou = m.userId === currentUserId;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.user.name} image={m.user.image} />
                      <div>
                        <p className="text-sm font-medium">
                          {m.user.name}
                          {isYou && (
                            <span className="ml-1.5 rounded bg-muted px-1 py-px text-[9px] text-muted-foreground">
                              you
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RolePill role={m.role} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs",
                        presence?.status === "online"
                          ? "font-medium text-green-500"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatLastSeen(presence)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canManage && !isYou && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(["admin", "member"] as const).map((r) => (
                            <DropdownMenuItem
                              key={r}
                              disabled={m.role === r}
                              onClick={() =>
                                updateRole.mutate({
                                  organizationId,
                                  memberId: m.id,
                                  role: r,
                                })
                              }
                            >
                              Change to {r}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              removeMember.mutate({
                                organizationId,
                                memberIdOrEmail: m.id,
                              })
                            }
                          >
                            Remove from workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              Pending invitations
            </span>
            <span className="text-xs text-muted-foreground">
              {invitations.length}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-[100px]">Role</TableHead>
                <TableHead className="w-[130px]">Expires</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const daysLeft = Math.ceil(
                  (new Date(inv.expiresAt).getTime() - Date.now()) /
                    86_400_000,
                );
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed bg-muted text-xs text-muted-foreground">
                          +
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {inv.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RolePill role={inv.role ?? "member"} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs",
                          daysLeft <= 3
                            ? "font-medium text-amber-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {daysLeft > 0 ? `${daysLeft}d` : "Expired"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              authClient.organization.cancelInvitation({
                                invitationId: inv.id,
                              })
                            }
                          >
                            Revoke invitation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

Add the missing import at the top of `members-table.tsx`:
```ts
import { authClient } from "@/lib/auth-client";
```

Also add a `useCancelInvitation` hook to `use-auth.tsx` and use it instead of calling `authClient` directly:

```ts
// In use-auth.tsx — add after useUpdateMemberRole
export function useCancelInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "org-full"] });
    },
  });
}
```

Then in `members-table.tsx`, replace the inline `authClient.organization.cancelInvitation` call with `useCancelInvitation`.

### Step 2: Create the route file

```tsx
// apps/web/src/routes/_workspace/$orgSlug/settings/members.tsx
import { createFileRoute } from "@tanstack/react-router";
import { InviteMemberModal } from "@/components/workspace/invite-member-modal";
import { MembersTable } from "@/components/workspace/members-table";
import { useOrgMembers, useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/members")({
  component: MembersPage,
});

function MembersPage() {
  const { targetOrg } = Route.useRouteContext();
  const { data: org, isLoading } = useOrgMembers(targetOrg.id);
  const { data: session } = useSession();

  if (isLoading || !org || !session) return null;

  const currentMember = org.members?.find(
    (m) => m.userId === session.user.id,
  );
  const currentRole = currentMember?.role ?? "member";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage who has access to this workspace.
          </p>
        </div>
        <InviteMemberModal organizationId={targetOrg.id} />
      </div>

      <MembersTable
        members={org.members ?? []}
        invitations={
          (org.invitations ?? []).filter((i) => i.status === "pending")
        }
        organizationId={targetOrg.id}
        currentUserId={session.user.id}
        currentRole={currentRole}
      />
    </div>
  );
}
```

### Step 3: Verify in browser

Navigate to `/<orgSlug>/settings/members`. Member list should render with Role and Last seen columns. Click "Invite members" — modal should open. Three-dot menu on a member row shows "Change to admin", "Change to member", "Remove from workspace".

### Step 4: Run checks

```bash
npm run check && npm run check-types
```

Fix any issues.

### Step 5: Commit

```bash
git add apps/web/src/routes/_workspace/$orgSlug/settings/members.tsx \
        apps/web/src/components/workspace/members-table.tsx \
        apps/web/src/hooks/use-auth.tsx
git commit -m "feat(settings): add Members page with invite modal and role management"
```

---

## Task 10: Final check — run full build

```bash
npm run build
```

Expected: all packages build without errors. Fix any type errors surfaced by the full build.

```bash
git add -A
git commit -m "chore: fix any build errors from settings admin feature"
```

---

## Checklist

- [ ] Task 1 — `useOrgMembers` + `useOrgRole` hooks
- [ ] Task 2 — `SettingsSidebar` component
- [ ] Task 3 — Settings shell with sidebar layout
- [ ] Task 4 — Settings index redirect
- [ ] Task 5 — General settings page (auto-save + danger zone)
- [ ] Task 6 — Backend `GET /presence` endpoint
- [ ] Task 7 — `useOrgPresence` hook + `formatLastSeen`
- [ ] Task 8 — `InviteMemberModal`
- [ ] Task 9 — `MembersTable` + Members route
- [ ] Task 10 — Full build passes
