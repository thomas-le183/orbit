# Chat Backend Design

**Date:** 2026-04-11
**Scope:** NestJS backend for org-scoped chat — channels, DMs, threads, reactions, file attachments, and user presence/activity.

---

## Overview

A Slack-style chat system built on top of the existing multi-tenant org structure. All chat data is scoped to an `organization`. Real-time delivery uses a single Socket.IO gateway (`@nestjs/websockets`). File attachments are stored in S3/MinIO via pre-signed URLs (client uploads directly to storage — files never pass through NestJS). Typing indicators are in-memory only; all other state is persisted in PostgreSQL via Drizzle ORM.

---

## Data Model

All new tables live in `apps/api/src/db/schema/chat.ts`.

### `channel`
Org-scoped channels. Public channels are open to all org members. Private channels restrict access via `channelMember`.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `organizationId` | `text` | FK → `organization.id` cascade delete |
| `name` | `text` | unique within org |
| `description` | `text` | nullable |
| `isPrivate` | `boolean` | default `false` |
| `createdBy` | `text` | FK → `user.id` |
| `createdAt` | `timestamp` | |
| `updatedAt` | `timestamp` | |

### `channelMember`
Membership records for private channels only. Public channel access is derived from org membership.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `channelId` | `text` | FK → `channel.id` cascade delete |
| `userId` | `text` | FK → `user.id` cascade delete |
| `role` | `text` | `owner` \| `member` |
| `joinedAt` | `timestamp` | |

### `conversation`
DM conversations — covers both 1:1 and group DMs. The participant list determines the type at query time.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `organizationId` | `text` | FK → `organization.id` cascade delete |
| `createdAt` | `timestamp` | |

### `conversationParticipant`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `conversationId` | `text` | FK → `conversation.id` cascade delete |
| `userId` | `text` | FK → `user.id` cascade delete |
| `joinedAt` | `timestamp` | |

### `message`
Shared table for both channel messages and DM messages. Exactly one of `channelId` / `conversationId` is non-null. Thread replies point to their parent via `parentMessageId`.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `channelId` | `text` | nullable, FK → `channel.id` cascade delete |
| `conversationId` | `text` | nullable, FK → `conversation.id` cascade delete |
| `senderId` | `text` | FK → `user.id` |
| `content` | `text` | |
| `parentMessageId` | `text` | nullable, FK → `message.id` — thread replies only |
| `createdAt` | `timestamp` | |
| `updatedAt` | `timestamp` | |
| `deletedAt` | `timestamp` | nullable — soft delete |

### `messageAttachment`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `messageId` | `text` | FK → `message.id` cascade delete |
| `fileName` | `text` | original file name |
| `fileSize` | `integer` | bytes |
| `mimeType` | `text` | |
| `storageKey` | `text` | S3/MinIO object key |
| `createdAt` | `timestamp` | |

### `messageReaction`
One row per (message, user, emoji) triple. Toggle: insert if absent, delete if present.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `messageId` | `text` | FK → `message.id` cascade delete |
| `userId` | `text` | FK → `user.id` cascade delete |
| `emoji` | `text` | unicode emoji character |
| `createdAt` | `timestamp` | |

### `userPresence`
One row per (user, org) pair. Upserted on WS connect/disconnect and on manual status update.

| Column | Type | Notes |
|---|---|---|
| `userId` | `text` | PK composite with `organizationId` |
| `organizationId` | `text` | PK composite with `userId` |
| `status` | `text` | `online` \| `away` \| `offline` |
| `customStatus` | `text` | nullable |
| `customStatusEmoji` | `text` | nullable |
| `lastSeenAt` | `timestamp` | set on disconnect |
| `updatedAt` | `timestamp` | |

---

## Module Structure

```
apps/api/src/
  chat/
    chat.module.ts
    chat.gateway.ts             ← single Socket.IO gateway, all WS events
    channels/
      channels.controller.ts
      channels.service.ts
    conversations/
      conversations.controller.ts
      conversations.service.ts
    messages/
      messages.controller.ts
      messages.service.ts
    presence/
      presence.controller.ts
      presence.service.ts       ← owns in-memory typing state
  storage/
    storage.module.ts
    storage.service.ts          ← S3/MinIO abstraction via @aws-sdk/client-s3
  db/schema/
    chat.ts                     ← all new tables above
```

`ChatModule` is imported into `AppModule`. `StorageModule` is global so any module can inject `StorageService`.

---

## REST API

All endpoints are prefixed `/api` and protected by `AuthGuard`. The active org is resolved from `session.activeOrganizationId`.

### Channels

| Method | Path | Description |
|---|---|---|
| `GET` | `/channels` | List all channels in the active org |
| `POST` | `/channels` | Create a channel |
| `PATCH` | `/channels/:id` | Update channel name/description (owner or org admin) |
| `DELETE` | `/channels/:id` | Delete channel (owner or org admin) |
| `POST` | `/channels/:id/members` | Add a member to a private channel |
| `DELETE` | `/channels/:id/members/:userId` | Remove a member from a private channel |
| `GET` | `/channels/:id/messages` | Paginated message history (cursor: `beforeId`, returns 50 messages ordered by `createdAt DESC`) |

### Conversations (DMs)

| Method | Path | Description |
|---|---|---|
| `GET` | `/conversations` | List DM conversations the current user is in |
| `POST` | `/conversations` | Find or create a conversation for a given participant set |
| `GET` | `/conversations/:id/messages` | Paginated message history (cursor: `beforeId`, returns 50 messages ordered by `createdAt DESC`) |

### Attachments

| Method | Path | Description |
|---|---|---|
| `POST` | `/attachments/presign` | Generate a pre-signed S3/MinIO upload URL; returns `{ uploadUrl, storageKey }` |

### Presence

| Method | Path | Description |
|---|---|---|
| `PATCH` | `/presence` | Update current user's custom status / status enum |

---

## WebSocket Gateway

**Namespace:** `/` (default)
**Auth:** Socket.IO `use` middleware calls `auth.api.getSession()` on handshake. Invalid session → disconnect.

### Client → Server events

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ roomId: string }` | Join a channel or conversation room. Access check performed here. |
| `room:leave` | `{ roomId: string }` | Leave a room |
| `message:send` | `{ roomId, content, parentMessageId?, storageKeys? }` | Send a message. Server persists then broadcasts `message:new`. |
| `message:edit` | `{ messageId, content }` | Edit own message. Server broadcasts `message:updated`. |
| `message:delete` | `{ messageId }` | Soft-delete own message. Server broadcasts `message:deleted`. |
| `reaction:toggle` | `{ messageId, emoji }` | Add or remove a reaction. Server broadcasts `reaction:updated`. |
| `typing:start` | `{ roomId }` | Mark self as typing. Server broadcasts `typing:update`. |
| `typing:stop` | `{ roomId }` | Stop typing. Server broadcasts `typing:update`. |
| `presence:status` | `{ status, customStatus?, customStatusEmoji? }` | Update presence. Server persists + broadcasts `presence:update`. |

### Server → Client events

| Event | Payload | Description |
|---|---|---|
| `message:new` | Full message object with sender, attachments, reaction counts | New message in a room |
| `message:updated` | `{ messageId, content, updatedAt }` | Message edited |
| `message:deleted` | `{ messageId }` | Message soft-deleted |
| `reaction:updated` | `{ messageId, reactions: { emoji, count, userIds }[] }` | Reactions changed |
| `typing:update` | `{ roomId, userId, isTyping: boolean }` | Typing indicator |
| `presence:update` | `{ userId, status, customStatus, customStatusEmoji }` | User presence changed |

### Presence lifecycle

- **Connect:** upsert `userPresence` to `online`; socket automatically joins the org room (`org:{organizationId}`); broadcast `presence:update` to org room
- **Disconnect:** set `offline`, set `lastSeenAt = now()`; broadcast `presence:update` to org room
- **Typing:** stored in `Map<roomId, Map<userId, NodeJS.Timeout>>` inside `PresenceService`. Auto-cleared after 5 seconds — never persisted to DB

---

## File Upload Flow

1. Client calls `POST /api/attachments/presign` with `{ fileName, mimeType, fileSize }`
2. `StorageService` generates a pre-signed PUT URL (15-minute expiry) and returns `{ uploadUrl, storageKey }`
3. Client uploads the file directly to S3/MinIO via the pre-signed URL
4. Client includes `storageKeys` in `message:send`
5. Gateway validates each `storageKey` (must be owned by this user session — prefix with `userId/`) before persisting `messageAttachment` records

---

## Authorization Rules

### Channels
- Public channels: any org member can `room:join` and read/write
- Private channels: `room:join` checks `channelMember`; non-members receive an error event
- Update/delete channel: `channel.createdBy = userId` (public) OR `channelMember.role = owner` (private) OR org `admin`/`owner`
- Manage members of private channel: same ownership check as above

### Conversations
- `room:join` checks `conversationParticipant`; non-participants are rejected
- `POST /conversations` deduplicates — finds existing conversation with the exact same participant set before creating

### Messages
- Edit and delete: restricted to `message.senderId` or org `admin`/`owner`
- Soft delete: `deletedAt` is set; content is replaced with `"Message deleted"` on read; reactions and thread reply count are preserved

### Attachments
- `storageKey` is namespaced as `{userId}/{uuid}/{filename}` — gateway rejects keys that don't match the sending user

### Presence
- Any org member can read any other org member's presence
- Only the user themselves can write their own presence/custom status

---

## Storage Configuration

Uses `@aws-sdk/client-s3` for both environments. Configuration via environment variables:

| Variable | Dev (MinIO) | Prod (AWS S3) |
|---|---|---|
| `STORAGE_ENDPOINT` | `http://localhost:9000` | _(omit — uses AWS default)_ |
| `STORAGE_REGION` | `us-east-1` | `<aws-region>` |
| `STORAGE_BUCKET` | `orbit-dev` | `orbit-prod` |
| `STORAGE_ACCESS_KEY` | MinIO root user | AWS IAM key |
| `STORAGE_SECRET_KEY` | MinIO root password | AWS IAM secret |
| `STORAGE_FORCE_PATH_STYLE` | `true` | `false` |

MinIO runs as a Docker container in development. The same `StorageService` code serves both environments.
