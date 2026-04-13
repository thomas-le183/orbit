# Settings — Admin Design Spec

**Date:** 2026-04-13  
**Status:** Approved  
**Scope:** Unified settings with sidebar navigation, covering personal account settings and workspace admin settings.

---

## 1. Overview

Settings live entirely under `/$orgSlug/settings/*`. A persistent left sidebar groups pages into two sections:

- **Account** — personal settings, visible to all members
- **Workspace** — org-level admin settings, visible to `admin` and `owner` roles only

Teams management is explicitly out of scope for this iteration.

---

## 2. Route Structure

```
/$orgSlug/settings                    → redirects to /settings/profile
/$orgSlug/settings/profile            → Profile (Account)
/$orgSlug/settings/notifications      → Notifications (Account)
/$orgSlug/settings/general            → General (Workspace)
/$orgSlug/settings/members            → Members (Workspace)
/$orgSlug/settings/billing            → Billing (Workspace)
```

---

## 3. Layout

### Settings shell (`settings.tsx`)

Replaces the current centered `max-w-2xl` single-column layout with a two-column shell:

```
┌─────────────────┬──────────────────────────────────┐
│  Sidebar        │  Content (scrollable)             │
│  210px fixed    │  padding: 40px 48px               │
│                 │  inner max-width: 720px centered  │
└─────────────────┴──────────────────────────────────┘
```

The shell fills the full viewport height (`h-full flex`). Content area scrolls independently.

### Sidebar

- **Account** section label (non-clickable, muted)
  - Profile
  - Notifications
- Divider
- **Workspace** section label (non-clickable, muted)
  - General *(hidden if role is `member`)*
  - Members *(hidden if role is `member`)*
  - Billing *(hidden if role is `member`)*

Active item: subtle background highlight (`bg-sidebar-active`). No uppercase labels — sentence case throughout.

### Role gating

The current user's org membership role is read from `authClient.organization.getFullOrganization()` or the active session. Workspace section items are rendered only when `role === 'admin' || role === 'owner'`. The routes themselves also guard via `beforeLoad`.

---

## 4. Pages

### 4.1 Profile (`/settings/profile`)

Existing page — no changes in scope.

### 4.2 Notifications (`/settings/notifications`)

Existing page — no changes in scope.

### 4.3 General (`/settings/general`)

**Purpose:** Manage workspace identity — name, URL slug, logo.

**Layout:** Single card (`bg-card border rounded-lg`) with three rows separated by dividers. Label + hint on the left, input on the right (280px wide). No save button — **auto-saves on blur** via debounced mutation. A subtle inline "Saved ✓" indicator appears in green on successful save.

| Row | Label | Input | Hint |
|---|---|---|---|
| 1 | Workspace name | Text input | Displayed across the app and in email notifications |
| 2 | URL slug | Prefixed input (`orbit.app/`) | Changing this invalidates existing links |
| 3 | Logo | Avatar preview + Upload button | PNG or JPG, max 2 MB |

**Mutations used:**
- `useUpdateOrganization()` — for name and slug (already exists in `use-auth.tsx`)
- Logo: new upload flow via `StorageModule` (POST to `/storage/upload`, then update org `logo` field)

**Danger zone** (separate card below, `owner` only):

| Action | Button style | Behaviour |
|---|---|---|
| Transfer ownership | Secondary | Opens a modal to select a member; calls `organization.updateMemberRole` |
| Delete workspace | Destructive ghost | Opens a confirmation dialog requiring the user to type the workspace name; calls `useDeleteOrganization()` |

---

### 4.4 Members (`/settings/members`)

**Purpose:** View all workspace members, manage roles, invite new members, revoke pending invitations.

**Layout:** Centered `max-width: 720px`. Page title + "Invite members" button (top right). Filter bar below (search input + Role dropdown). Two section blocks: Active members and Pending invitations.

#### Toolbar
- Search input: client-side filter by name or email
- Role filter dropdown: All / Owner / Admin / Member

#### Active members table

Columns: **Member** (avatar + name + email) · **Role** · **Joined** · **Last seen** · **···**

- **Role pill** styles: Owner (amber), Admin (blue), Member (neutral)
- **Last seen**: sourced from `userPresence.lastSeen` in the chat schema. Shows "Online now" (green) when `status === 'online'`, otherwise relative time ("2 hours ago").
- **··· menu** actions (vary by current user's role):
  - Change role → submenu: Owner / Admin / Member (calls `useUpdateMemberRole`)
  - Remove from workspace (calls `useRemoveMember`) — disabled on self, disabled on owner if current user is not owner

#### Pending invitations table

Columns: **Email** · **Role** · **Invited** · **Expires** · **···**

- Sourced from `authClient.organization.listInvitations()`
- **··· menu**: Revoke invitation (calls `organization.cancelInvitation`)
- Expiry shown as "N days" with amber pill when < 3 days remaining

#### Invite members modal

Triggered by "Invite members" button. Fields:
- Email address (text input)
- Role selector (Admin / Member — Owner not invitable)
- Send invite button (calls `useInviteMember`)

On success: invalidates org query, new pending row appears in table.

**Data source:** `authClient.organization.getFullOrganization()` returns members and invitations. Wrapped in a `useQuery` hook `useOrgMembers(orgSlug)`.

---

### 4.5 Billing (`/settings/billing`)

Existing `BillingSettings` component — moves from `/$orgSlug/settings/billing` (same path) into the new settings shell. No functional changes.

---

## 5. Data & API

### Frontend hooks needed

| Hook | Source | Notes |
|---|---|---|
| `useOrgMembers(orgSlug)` | new | Calls `authClient.organization.getFullOrganization()`, returns `{ members, invitations }` |
| `useUpdateOrganization()` | exists | Already in `use-auth.tsx` |
| `useDeleteOrganization()` | exists | Already in `use-auth.tsx` |
| `useInviteMember()` | exists | Already in `use-auth.tsx` |
| `useRemoveMember()` | exists | Already in `use-auth.tsx` |
| `useUpdateMemberRole()` | exists | Already in `use-auth.tsx` |

### Logo upload

New flow: `POST /storage/upload` (multipart) → returns `{ url }` → `useUpdateOrganization({ logo: url })`.

### Last seen

Read from `userPresence` table via a new API endpoint: `GET /:orgSlug/presence` — returns `{ userId, status, lastSeen }[]`. Lightweight, no WebSocket needed for settings.

---

## 6. Component breakdown

```
apps/web/src/
  routes/_workspace/$orgSlug/
    settings.tsx                  ← replace with sidebar shell layout
    settings/
      profile.tsx                 ← existing, unchanged
      notifications.tsx           ← existing, unchanged
      general.tsx                 ← new
      members.tsx                 ← new
      billing.tsx                 ← existing, unchanged

  components/workspace/
    settings-sidebar.tsx          ← new sidebar nav component
    members-table.tsx             ← new members + invitations table
    invite-member-modal.tsx       ← new invite dialog
    general-settings.tsx          ← new general form card
```

All new components go in `apps/web/src/components/workspace/`. Shared UI primitives (Card, etc.) go in `packages/ui` if reusable elsewhere.

---

## 7. Design tokens / styling notes

- Page background: `bg-background` (darkest layer)
- Card background: one step above page — `bg-card` with `border` and `rounded-lg shadow-sm`
- Card row dividers: `divide-y divide-border`
- Role pills: inline `<span>` with variant classes (owner/admin/member)
- Sidebar active state: `bg-sidebar-active text-sidebar-active-foreground`
- Auto-save feedback: small `text-green-500` "Saved ✓" text, fades in/out via `useState` + `setTimeout`

---

## 8. Out of scope

- Teams management (deferred to next iteration)
- Bulk member actions
- Member profile detail view
- Audit log
- SSO / domain-based invite restrictions
