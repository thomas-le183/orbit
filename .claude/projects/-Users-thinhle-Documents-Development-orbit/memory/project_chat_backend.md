---
name: Chat backend implementation
description: Chat backend (channels, DMs, threads, reactions, presence, file uploads) — all 7 phases shipped
type: project
---

Full chat backend built on top of the org/workspace model. All committed to main.

**Why:** User wants to build a Slack-style chat for orgs.
**How to apply:** When building the frontend or extending the backend, refer to these conventions.

## Key decisions
- Single Socket.IO gateway (`chat.gateway.ts`) — no namespaces, no Redis adapter yet
- Room IDs are prefixed: `channel:<uuid>` or `conversation:<uuid>` — used in all WS events
- File uploads: client calls `POST /api/attachments/presign` first, uploads directly to MinIO/S3, then passes `storageKeys[]` in `message:send`
- `storageKey` ownership enforced at gateway: keys must start with `{userId}/`
- Typing indicators: in-memory only (`PresenceService` typing timers, 5 s auto-clear, never persisted)
- Presence upserted on WS connect (`online`) and disconnect (`offline` + `lastSeenAt`)
- Org room `org:{orgId}` — every socket joins on connect; presence updates broadcast here
- Cursor pagination: `?beforeId=<messageId>` on message history endpoints

## Modules added
- `apps/api/src/chat/` — channels, conversations, messages, attachments, presence, gateway
- `apps/api/src/storage/` — StorageService wrapping @aws-sdk/client-s3

## Schema (apps/api/src/db/schema/chat.ts)
channel, channel_member, conversation, conversation_participant,
message, message_attachment, message_reaction, user_presence

## REST endpoints (all under /api, behind AuthGuard)
- GET/POST /channels
- PATCH/DELETE /channels/:id
- POST/DELETE /channels/:id/members
- GET /channels/:id/messages?beforeId=
- GET/POST /conversations
- GET /conversations/:id/messages?beforeId=
- GET /messages/:id/thread
- POST /attachments/presign
- PATCH /presence

## WebSocket events
C→S: room:join, room:leave, message:send, message:edit, message:delete, reaction:toggle, typing:start, typing:stop, presence:status
S→C: message:new, message:updated, message:deleted, reaction:updated, typing:update, presence:update

## MinIO (dev)
- Runs in docker-compose-local.yml on ports 9000 (API) / 9001 (console)
- Bucket: orbit-dev, credentials: minioadmin/minioadmin
- Env vars: STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_FORCE_PATH_STYLE
