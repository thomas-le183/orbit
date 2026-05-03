# Exception Filter Design

**Date:** 2026-05-03  
**Status:** Approved

## Overview

A global NestJS exception filter that catches all thrown exceptions and serializes them into a consistent JSON shape aligned with better-auth's `APIError` body format, supporting future i18n via machine-readable error codes.

## Response Shape

Every error response from the API will have this body:

```ts
{
  statusCode: number;  // HTTP status code
  message: string;     // Human-readable English string, never an array
  code: string;        // Domain-specific SCREAMING_SNAKE_CASE code for i18n
}
```

`code` is a **domain-specific** `SCREAMING_SNAKE_CASE` error identifier, consistent with better-auth's own error codes (`USER_NOT_FOUND`, `EMAIL_MISMATCH`, etc.). Examples: `USER_NOT_FOUND`, `EMAIL_DOES_NOT_MATCH`, `ORGANIZATION_MEMBER_LIMIT_REACHED`. When no specific code is provided, falls back to an HTTP-derived code (e.g. `NOT_FOUND`, `UNAUTHORIZED`).

Example with specific code:
```json
{
  "statusCode": 404,
  "message": "User not found",
  "code": "USER_NOT_FOUND"
}
```

Example with fallback code:
```json
{
  "statusCode": 401,
  "message": "Invalid or expired session",
  "code": "UNAUTHORIZED"
}
```

## Files

| Action | Path |
|--------|------|
| Create | `apps/api/src/common/filters/http-exception.filter.ts` |
| Modify | `apps/api/src/main.ts` — register global filter |
| Modify | `apps/web/src/lib/api.ts` — update `ApiError` type |

## Filter Logic

### HttpException (NestJS built-ins + manual throws)

Callers pass a specific code by throwing with a structured body:

```ts
throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' })
throw new BadRequestException({ code: 'EMAIL_DOES_NOT_MATCH', message: 'Email does not match' })
```

1. Extract `status` via `exception.getStatus()`
2. Extract `response` via `exception.getResponse()` — may be a string or an object
3. Derive `message`:
   - If `response` is a string → use it directly
   - If `response.message` is an array (ValidationPipe) → join with `"; "`
   - Otherwise → use `response.message` or fall back to the HTTP status text
4. Derive `code`:
   - If `response.code` is present → use it as-is (domain-specific code)
   - Otherwise fall back to HTTP-derived code using a map:
     - 400 → `BAD_REQUEST`, 401 → `UNAUTHORIZED`, 403 → `FORBIDDEN`
     - 404 → `NOT_FOUND`, 409 → `CONFLICT`, 422 → `UNPROCESSABLE_ENTITY`
     - 429 → `TOO_MANY_REQUESTS`, 500 → `INTERNAL_SERVER_ERROR`
     - Any unmapped status → `HTTP_${statusCode}`

### Non-HttpException (unexpected errors)

- `statusCode`: 500
- `message`: `"Internal server error"` (never expose internals)
- `code`: `"INTERNAL_SERVER_ERROR"`
- Log the full error using NestJS `Logger` at `error` level

## Frontend ApiError Type Update

`apps/web/src/lib/api.ts` — replace `error?: string` with `code: string`:

```ts
export type ApiError = {
  statusCode: number;
  message: string;
  code: string;
};
```

The Axios interceptor condition (`"statusCode" in data`) remains unchanged.

## Registration

In `apps/api/src/main.ts`, register before `useGlobalPipes`:

```ts
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalPipes(new ValidationPipe({ ... }));
```

## What This Does Not Cover

- Rate limiting responses (handled by NestJS Throttler — uses `ThrottlerException` which extends `HttpException`, so it is covered)
- WebSocket errors (Socket.io gateway errors are a separate concern)
- Stripe webhook errors (raw body endpoint — uses its own error handling)
