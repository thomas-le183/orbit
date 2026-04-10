# Chat Backend — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-11-chat-backend-design.md`
**Date:** 2026-04-11

Each phase is self-contained and shippable. Complete phases in order — later phases depend on earlier ones.

---

## Phase 1 — Drizzle Schema

**Goal:** Add all new tables to the database. No business logic yet.

### Steps

1. **Create `apps/api/src/db/schema/chat.ts`** with all 7 tables:
   - `channel`
   - `channelMember`
   - `conversation`
   - `conversationParticipant`
   - `message`
   - `messageAttachment`
   - `messageReaction`
   - `userPresence` (composite PK: `userId` + `organizationId`)

2. **Re-export from `apps/api/src/db/schema/index.ts`**
   Add `export * from "./chat";`

3. **Generate and run migration**
   ```bash
   cd apps/api && npm run db:generate && npm run db:migrate
   ```

4. **Verify** with `npm run db:studio` — confirm all 7 tables are present.

### Files touched
- `apps/api/src/db/schema/chat.ts` ← new
- `apps/api/src/db/schema/index.ts` ← add export

---

## Phase 2 — Storage Module

**Goal:** `StorageService` that wraps `@aws-sdk/client-s3` for both MinIO (dev) and S3 (prod). No chat logic yet.

### Steps

1. **Install dependency**
   ```bash
   cd apps/api && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

2. **Create `apps/api/src/storage/storage.module.ts`** — global module

3. **Create `apps/api/src/storage/storage.service.ts`** with two methods:
   - `generatePresignedUploadUrl(key: string, mimeType: string, expiresIn = 900): Promise<string>`
     Uses `PutObjectCommand` + `getSignedUrl`
   - `deleteObject(key: string): Promise<void>`
     For cleanup if a message is deleted

4. **Add env vars** to `.env` and `.env.example`:
   ```
   STORAGE_ENDPOINT=http://localhost:9000
   STORAGE_REGION=us-east-1
   STORAGE_BUCKET=orbit-dev
   STORAGE_ACCESS_KEY=minioadmin
   STORAGE_SECRET_KEY=minioadmin
   STORAGE_FORCE_PATH_STYLE=true
   ```

5. **Register `StorageModule`** in `AppModule` imports (mark as `@Global`)

6. **Add MinIO to Docker Compose** (or document the `docker run` command for dev setup):
   ```yaml
   minio:
     image: minio/minio
     ports: ["9000:9000", "9001:9001"]
     environment:
       MINIO_ROOT_USER: minioadmin
       MINIO_ROOT_PASSWORD: minioadmin
     command: server /data --console-address ":9001"
   ```

### Files touched
- `apps/api/src/storage/storage.module.ts` ← new
- `apps/api/src/storage/storage.service.ts` ← new
- `apps/api/src/app.module.ts` ← add StorageModule
- `.env` / `.env.example` ← add STORAGE_* vars
- `docker-compose.yml` (root) ← add MinIO service (create if absent)

---

## Phase 3 — Channels

**Goal:** Full CRUD for channels + private channel membership. REST only, no WebSocket yet.

### Steps

1. **Create `apps/api/src/chat/channels/channels.service.ts`**
   - `listChannels(orgId: string, userId: string)` — returns public channels + private channels where user is a member
   - `createChannel(orgId, userId, dto)` — inserts channel; if private, inserts creator as `channelMember` with `role = owner`
   - `updateChannel(channelId, userId, orgRole, dto)` — checks ownership (see auth rules)
   - `deleteChannel(channelId, userId, orgRole)` — checks ownership, cascades via DB
   - `addMember(channelId, userId, orgRole, targetUserId)` — inserts `channelMember`
   - `removeMember(channelId, userId, orgRole, targetUserId)` — deletes `channelMember`

2. **Create `apps/api/src/chat/channels/channels.controller.ts`**
   - `GET /channels`
   - `POST /channels`
   - `PATCH /channels/:id`
   - `DELETE /channels/:id`
   - `POST /channels/:id/members`
   - `DELETE /channels/:id/members/:userId`
   All behind `AuthGuard`. Resolve `orgId` from `session.activeOrganizationId`.

3. **Create `apps/api/src/chat/chat.module.ts`** — imports `DbModule`, declares channels controller/service.

4. **Register `ChatModule`** in `AppModule`.

### Files touched
- `apps/api/src/chat/chat.module.ts` ← new
- `apps/api/src/chat/channels/channels.service.ts` ← new
- `apps/api/src/chat/channels/channels.controller.ts` ← new
- `apps/api/src/app.module.ts` ← add ChatModule

---

## Phase 4 — Conversations (DMs)

**Goal:** Create/find DM conversations and list them.

### Steps

1. **Create `apps/api/src/chat/conversations/conversations.service.ts`**
   - `listConversations(orgId, userId)` — conversations where user is a participant
   - `findOrCreate(orgId, userId, participantIds[])` — deduplicate: query for conversation with exactly this participant set in this org; create if not found; add requesting user to `participantIds` if not already present

2. **Create `apps/api/src/chat/conversations/conversations.controller.ts`**
   - `GET /conversations`
   - `POST /conversations` body: `{ participantIds: string[] }`

3. **Add to `ChatModule`.**

### Files touched
- `apps/api/src/chat/conversations/conversations.service.ts` ← new
- `apps/api/src/chat/conversations/conversations.controller.ts` ← new
- `apps/api/src/chat/chat.module.ts` ← add conversations

---

## Phase 5 — Messages REST

**Goal:** Paginated message history for channels and conversations. No send/edit/delete yet (those come via WebSocket).

### Steps

1. **Create `apps/api/src/chat/messages/messages.service.ts`**
   - `getChannelMessages(channelId, userId, orgId, beforeId?, limit = 50)`
     — verifies access (public channel OR channelMember), returns messages with sender, attachments, and reaction summary `{ emoji, count, userIds }[]`, ordered `createdAt DESC`
   - `getConversationMessages(conversationId, userId, beforeId?, limit = 50)`
     — verifies participant, same shape

2. **Create `apps/api/src/chat/messages/messages.controller.ts`**
   - `GET /channels/:id/messages?beforeId=`
   - `GET /conversations/:id/messages?beforeId=`

3. **Create `apps/api/src/chat/attachments/attachments.controller.ts`**
   - `POST /attachments/presign` body: `{ fileName, mimeType, fileSize }`
     — builds key `{userId}/{randomUUID()}/{fileName}`, calls `StorageService.generatePresignedUploadUrl`, returns `{ uploadUrl, storageKey }`

4. **Add to `ChatModule`.**

### Files touched
- `apps/api/src/chat/messages/messages.service.ts` ← new
- `apps/api/src/chat/messages/messages.controller.ts` ← new
- `apps/api/src/chat/attachments/attachments.controller.ts` ← new
- `apps/api/src/chat/chat.module.ts` ← add messages, attachments

---

## Phase 6 — WebSocket Gateway

**Goal:** Real-time events for messages, reactions, typing, and presence.

### Steps

1. **Install WebSocket dependencies**
   ```bash
   cd apps/api && npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
   ```

2. **Create `apps/api/src/chat/presence/presence.service.ts`**
   - Owns in-memory typing state: `Map<roomId, Map<userId, NodeJS.Timeout>>`
   - `setTyping(roomId, userId)` — resets 5s timeout, returns `isTyping: true`
   - `clearTyping(roomId, userId)` — clears timeout, returns `isTyping: false`
   - `upsertPresence(userId, orgId, status, customStatus?, customStatusEmoji?)` — DB upsert
   - `setOffline(userId, orgId)` — sets `offline` + `lastSeenAt`

3. **Create `apps/api/src/chat/chat.gateway.ts`** — `@WebSocketGateway({ cors: ... })`
   - Auth middleware on `handleConnection`: call `auth.api.getSession()`, attach to `socket.data`; disconnect if invalid
   - On connect: join org room `org:{orgId}`, upsert presence to `online`, emit `presence:update` to org room
   - On disconnect: `setOffline`, emit `presence:update` to org room
   - Handle `room:join` — access check (public channel / channelMember / conversationParticipant), then `socket.join(roomId)`
   - Handle `room:leave` — `socket.leave(roomId)`
   - Handle `message:send` — validate storageKeys prefix, persist message + attachments via `MessagesService`, emit `message:new` to room
   - Handle `message:edit` — ownership check, update DB, emit `message:updated` to room
   - Handle `message:delete` — ownership check, soft delete, emit `message:deleted` to room
   - Handle `reaction:toggle` — insert or delete `messageReaction`, emit `reaction:updated` to room
   - Handle `typing:start` / `typing:stop` — call `PresenceService`, emit `typing:update` to room
   - Handle `presence:status` — call `PresenceService.upsertPresence`, emit `presence:update` to org room

4. **Extend `MessagesService`** with write methods used by the gateway:
   - `createMessage(dto)` → persists message + attachments, returns full message object
   - `editMessage(messageId, userId, orgRole, content)` → ownership check + update
   - `softDeleteMessage(messageId, userId, orgRole)` → sets `deletedAt`
   - `toggleReaction(messageId, userId, emoji)` → upsert/delete, returns updated reaction list

5. **Add `PresenceController`** for the REST PATCH:
   - `PATCH /presence` body: `{ status?, customStatus?, customStatusEmoji? }` → calls `PresenceService.upsertPresence`

6. **Add gateway + presence service/controller to `ChatModule`.**

### Files touched
- `apps/api/src/chat/chat.gateway.ts` ← new
- `apps/api/src/chat/presence/presence.service.ts` ← new
- `apps/api/src/chat/presence/presence.controller.ts` ← new
- `apps/api/src/chat/messages/messages.service.ts` ← extend with write methods
- `apps/api/src/chat/chat.module.ts` ← add gateway, presence

---

## Phase 7 — Validation & Polish

**Goal:** Input validation, error responses, and a smoke-test run.

### Steps

1. **Install validation pipe**
   ```bash
   cd apps/api && npm install class-validator class-transformer
   ```
   Enable `ValidationPipe` globally in `main.ts`:
   ```ts
   app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
   ```

2. **Add DTOs** with `class-validator` decorators for all controller inputs and gateway event payloads.

3. **Guard the `session.activeOrganizationId`** — if null, return `403 No active organization` on all chat endpoints.

4. **Smoke test** the full flow manually:
   - Create a channel → join room → send a message with an attachment → react → open thread reply → check presence updates

5. **Run type-check and lint**
   ```bash
   npm run check-types && npm run check
   ```

### Files touched
- `apps/api/src/main.ts` ← add ValidationPipe
- `apps/api/src/chat/**/dto/` ← new DTO files per feature

---

## Dependency order

```
Phase 1 (Schema)
  └─ Phase 2 (Storage)
       └─ Phase 3 (Channels)
            └─ Phase 4 (Conversations)
                 └─ Phase 5 (Messages REST)
                      └─ Phase 6 (WebSocket Gateway)
                           └─ Phase 7 (Validation & Polish)
```

Start with Phase 1. Each phase produces working, committable code before the next begins.
