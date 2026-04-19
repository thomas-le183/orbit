# Settings Redesign — Design Spec

**Date:** 2026-04-20
**Scope:** Profile, Workspace (General), Members
**Out of scope for this round:** Notifications, Billing (route stubs only), password/2FA/sessions, timezone/language, image storage infrastructure

## Goals

- Replace the current uneven settings UI with one consistent, quiet, Linear-style pattern across every page.
- Give settings a small, well-defined primitive layer (`SettingsPage`, `SettingsSection`, `SettingsRow`) so new pages cost almost nothing to add.
- Wire user profile mutations (currently un-wired inputs) to `better-auth`.
- Consolidate duplicate routes (`settings/workspace` vs orphan `settings/general`).

## Non-goals

- Full-screen "takeover" settings shell — stays within the workspace shell (AppNav + AppSidebar + content) because the existing sidebar already renders settings sections and the app-nav is always-on.
- Real image upload. Avatar and logo accept a URL only this round.
- Billing and notification content. Routes render a "Coming soon" stub.
- Bulk invite, custom roles, teams/groups — not needed for current MVP.
- Mobile layout — desktop-only, matching the rest of the app.

## UX patterns

### Page skeleton

Every settings page renders the same structure:

```tsx
<SettingsPage title="Profile" subtitle="Personal info visible across Orbit.">
  <SettingsSection>
    <SettingsRow label="Full name" hint="Shown everywhere you appear.">
      <Input … />
    </SettingsRow>
    …
  </SettingsSection>

  <SettingsSection heading="Danger zone" tone="destructive">
    …
  </SettingsSection>
</SettingsPage>
```

### Visual rules

- Flat rows separated by thin dividers — no per-row cards, no shadowed surfaces.
- Row left: label (`text-sm font-medium`) + hint (`text-xs text-muted-foreground`).
- Row right: fixed-width control (~`w-[280px]`), right-aligned in the row.
- Section heading (optional): small uppercase muted label above a section's rows.
- Tone: `destructive` sections get a muted red ring/border and a "Danger zone" heading; destructive row labels/buttons keep the red accent.

### Save UX

- **Inline save on blur.** Mutation fires when an input loses focus and the value differs from the last-saved value.
- **"Saved ✓"** indicator appears for ~1.5s on the row when the mutation succeeds, then fades.
- No page-level "Save changes" button anywhere (redesign removes them).
- **Destructive actions** (Delete account, Delete workspace, Transfer ownership, Remove member, Revoke invite) never save inline — they open a confirmation dialog with a "type the name to confirm" input where the consequence is permanent.
- Failed mutations surface an error under the control in `text-destructive` + revert the input to the previous value.

### Forms

All forms use `@tanstack/react-form` per CLAUDE.md. No `react-hook-form`, no `formik`.

## Routing & navigation

- `/$orgSlug/settings` — redirects to `/$orgSlug/settings/profile` (already the case in `settings.tsx` — no change).
- `/$orgSlug/settings/profile` — Profile page.
- `/$orgSlug/settings/notifications` — stub: "Coming soon".
- `/$orgSlug/settings/workspace` — Workspace (General) page. Keep this route; delete the orphan `/$orgSlug/settings/general.tsx`.
- `/$orgSlug/settings/members` — Members page.
- `/$orgSlug/settings/billing` — stub: "Coming soon".
- Sidebar continues to use [config/navigation.ts](apps/web/src/config/navigation.ts) as the single source of truth. The "General" item already points to `/settings/workspace` — no change needed there.
- `settings.tsx` layout unchanged (renders `<Outlet />`).

## Component architecture

New files under [apps/web/src/components/workspace/settings/](apps/web/src/components/workspace/settings/):

| File | Responsibility |
| --- | --- |
| `settings-page.tsx` | `SettingsPage` wrapper — title, subtitle, vertical section stack |
| `settings-section.tsx` | `SettingsSection` — optional heading, optional destructive tone, container for rows |
| `settings-row.tsx` | `SettingsRow` — label + hint (left) and control slot (right). Also exports a `useSaveIndicator()` hook (already exists inside `general-settings.tsx` — lift into here) |
| `profile-settings.tsx` | Profile form (avatar URL, name, email read-only) |
| `delete-account-dialog.tsx` | Confirm dialog for account deletion |
| `general-settings.tsx` | Rewritten to use the new primitives (existing file — keep name, refactor) |
| `members-table.tsx` | Refactor existing table to match the new row/section pattern |
| `invite-member-modal.tsx` | Existing — keep, light restyling |

Settings-specific components stay under `workspace/settings/` per the directory convention we just established. Shared avatar components (`UserAvatar`, `OrgAvatar`) stay at `components/common/`.

## Per-page content

### Profile — `/settings/profile`

Sections:

1. **Identity**
   - Row: **Avatar** — right side is the current `UserAvatar` + an `Input` for avatar URL (inline save on blur). Hint: "Paste an image URL. Upload is coming later."
   - Row: **Full name** — `Input`, inline save on blur.
   - Row: **Email** — `Input` disabled with a small "Verified" pill adjacent. Email change is out of scope.
2. **Danger zone** (destructive tone)
   - Row: **Delete account** — `Button variant="destructive"` opens `DeleteAccountDialog`. Dialog requires typing the user's email to confirm.

Mutations:

- Name, avatar: `authClient.updateUser({ name?, image? })` via better-auth, wrapped in a new `useUpdateUser` hook in `hooks/use-auth.tsx`.
- Delete account: `authClient.deleteUser()` via a new `useDeleteAccount` hook. On success: redirect to `/`.

### Workspace — `/settings/workspace`

Sections:

1. **Identity**
   - Row: **Logo** — right side is `OrgAvatar` + `Input` for logo URL (inline save on blur).
   - Row: **Workspace name** — `Input`, inline save.
   - Row: **URL slug** — `Input` with a `orbit.app/` prefix addon, inline save.
2. **Danger zone** (destructive tone, owner-only)
   - Row: **Transfer ownership** — `Button variant="outline"` (disabled for now — keep a TODO; dialog is out of this round's scope).
   - Row: **Delete workspace** — `Button variant="destructive"` opens confirm dialog requiring workspace name.

Reuse existing `useUpdateOrganization` / `useDeleteOrganization` hooks. `logo` field already exists on the `organization` table (no migration needed).

### Members — `/settings/members`

- Page header: title + subtitle + **Invite member** button (top-right, opens existing `InviteMemberModal`).
- **Active members** section:
  - Table columns: Member (avatar + name + email), Role (pill), Joined, Last seen, row-action menu.
  - Filter toolbar above the table: search input + role filter (existing behavior — simplify styling to match the new look).
  - Row actions (admin/owner only, not on self): Change role → admin/member, Remove from workspace.
- **Pending invitations** section (only if there are any):
  - Columns: Email, Role, Expires, row-action menu.
  - Row actions: Revoke invitation.
- Uses existing hooks (`useOrgMembers`, `useUpdateMemberRole`, `useRemoveMember`, `useCancelInvitation`, `useInviteMember`). No data-layer changes.

### Notifications — `/settings/notifications`

Stub:

```tsx
<SettingsPage title="Notifications" subtitle="…">
  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
    Coming soon.
  </div>
</SettingsPage>
```

### Billing — `/settings/billing`

Same "Coming soon" stub pattern. The existing `billing-settings.tsx` content is replaced.

## Data & auth

- **Better-auth `updateUser`** is used by Profile. Schema already has `user.name` and `user.image` columns — no migration.
- **Better-auth `deleteUser`** — check that the plugin is configured in `apps/api/src/auth`. If not, add it. This is a prereq task in the implementation plan.
- **Organization** `logo`, `name`, `slug` all exist. No migration.
- **Authorization:** page-level guards are unchanged — `settings.tsx` already redirects unauthenticated users. Owner-only rows gate purely in the UI via `useOrgRole`.

## Testing

- Vitest unit tests for `SettingsRow` (renders label/hint/children, destructive tone class), `useSaveIndicator` (transitions state, timer cleanup).
- `profile-settings.tsx`: test that onBlur name change fires `updateUser` with the trimmed value, and that identical values don't trigger a mutation.
- `DeleteAccountDialog` / delete-workspace dialog: submit button disabled until confirmation text matches.
- Members role-change UI gating by `currentRole` — smoke test only.
- No new E2E tests in this round.

## Migration / cleanup

- Delete [apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx](apps/web/src/routes/_workspace/$orgSlug/settings/general.tsx) (orphan).
- Remove the old page-level "Save changes" buttons from the stub `profile.tsx` and `workspace.tsx` routes when rewriting.
- `billing-settings.tsx` is replaced by a stub — delete the old implementation.

## Open questions (tracked, not blocking)

- When real image upload is added, the `Input url` rows should become `Input url + Upload button` rows. Primitive already supports this (children slot is free-form).
- Email change / 2FA / sessions / timezone / language are all deferred. When scheduled, each becomes a new `SettingsSection` in Profile — no primitive changes.
