# Error Handling Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete error handling foundation: shared typed error codes, domain exception classes on the API, a type-safe `isApiError` guard on the web, 401 session-expiry redirect, and a global query error fallback.

**Architecture:** Shared error codes live in `packages/shared` so both API and web import from a single source of truth. The API gets a thin `AppException` base class that wraps NestJS `HttpException` with a typed code. The web gets a `isApiError` type guard, a dedicated `router.ts` module (so the Axios interceptor can redirect without React context), and a `QueryCache` global error handler.

**Tech Stack:** NestJS, `@nestjs/common` HttpException, `packages/shared` (`@orbit/shared`), Axios, TanStack Query v5, TanStack Router, Sonner toasts, Jest (API tests), Vitest (web tests).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/types/error-codes.ts` | `API_ERROR_CODES` const + `ApiErrorCode` type |
| Modify | `packages/shared/src/index.ts` | Export new error codes |
| Create | `apps/api/src/common/exceptions/app.exception.ts` | `AppException` base class |
| Create | `apps/api/src/common/exceptions/app.exception.spec.ts` | Unit tests for `AppException` |
| Create | `apps/api/src/common/exceptions/index.ts` | Re-export exceptions |
| Modify | `apps/web/src/lib/api.ts` | Add `isApiError` guard, update interceptor |
| Create | `apps/web/src/lib/router.ts` | Extracted router instance (needed by interceptor) |
| Modify | `apps/web/src/main.tsx` | Import router from `lib/router.ts` |
| Modify | `apps/web/src/lib/query-client.ts` | Add `QueryCache` global error handler |
| Modify | `apps/web/src/components/auth/login-form.tsx` | Fix `catch (err: any)` |
| Modify | `apps/web/src/components/auth/signup-form.tsx` | Fix `catch (err: any)` ×2 |
| Modify | `apps/web/src/routes/create-workspace.tsx` | Fix `catch (err: any)` |

---

## Task 1: Shared error codes

**Files:**
- Create: `packages/shared/src/types/error-codes.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `error-codes.ts`**

```ts
// packages/shared/src/types/error-codes.ts
export const API_ERROR_CODES = {
  // HTTP-derived (match HttpExceptionFilter fallback map)
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
```

- [ ] **Step 2: Export from `packages/shared/src/index.ts`**

Add to the existing exports (do not remove anything):

```ts
export {
  API_ERROR_CODES,
  type ApiErrorCode,
} from "./types/error-codes.js";
```

- [ ] **Step 3: Verify type-check passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/error-codes.ts packages/shared/src/index.ts
git commit -m "feat(shared): add API_ERROR_CODES const and ApiErrorCode type"
```

---

## Task 2: Domain exception base class

**Files:**
- Create: `apps/api/src/common/exceptions/app.exception.ts`
- Create: `apps/api/src/common/exceptions/app.exception.spec.ts`
- Create: `apps/api/src/common/exceptions/index.ts`

The `AppException` base class wraps NestJS `HttpException` and accepts a typed code from `API_ERROR_CODES` (or any string for domain-specific codes not yet in the shared const). The `HttpExceptionFilter` already reads `body.code`, so no filter changes are needed.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/common/exceptions/app.exception.spec.ts
import { AppException } from "./app.exception";

describe("AppException", () => {
  it("sets statusCode, message, and code on the response body", () => {
    const ex = new AppException("USER_NOT_FOUND", "User not found", 404);
    expect(ex.getStatus()).toBe(404);
    const body = ex.getResponse() as Record<string, unknown>;
    expect(body).toEqual({ code: "USER_NOT_FOUND", message: "User not found" });
  });

  it("defaults to 500 when no status is provided", () => {
    const ex = new AppException("INTERNAL_SERVER_ERROR", "Something broke");
    expect(ex.getStatus()).toBe(500);
  });

  it("message is accessible via getMessage()", () => {
    const ex = new AppException("FORBIDDEN", "No access", 403);
    expect(ex.message).toBe("No access");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test -- --testPathPattern=app.exception.spec
```

Expected: FAIL — `AppException` not defined.

- [ ] **Step 3: Implement `AppException`**

```ts
// apps/api/src/common/exceptions/app.exception.ts
import { HttpException } from "@nestjs/common";

export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status = 500,
  ) {
    super({ code, message }, status);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && pnpm test -- --testPathPattern=app.exception.spec
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Create the barrel export**

```ts
// apps/api/src/common/exceptions/index.ts
export { AppException } from "./app.exception";
```

- [ ] **Step 6: Verify type-check passes**

```bash
cd apps/api && pnpm typecheck 2>/dev/null || pnpm build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/exceptions/
git commit -m "feat(api): add AppException base class with typed code"
```

---

## Task 3: `isApiError` type guard + fix `catch (err: any)`

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/components/auth/login-form.tsx`
- Modify: `apps/web/src/components/auth/signup-form.tsx`
- Modify: `apps/web/src/routes/create-workspace.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/api.test.ts
import { isApiError } from "./api";

describe("isApiError", () => {
  it("returns true for a well-formed ApiError", () => {
    expect(
      isApiError({ statusCode: 404, message: "Not found", code: "NOT_FOUND" }),
    ).toBe(true);
  });

  it("returns false for a plain Error", () => {
    expect(isApiError(new Error("boom"))).toBe(false);
  });

  it("returns false for null", () => {
    expect(isApiError(null)).toBe(false);
  });

  it("returns false when statusCode is missing", () => {
    expect(isApiError({ message: "oops", code: "BAD" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test -- --run api.test
```

Expected: FAIL — `isApiError` is not exported from `./api`.

- [ ] **Step 3: Add `isApiError` to `apps/web/src/lib/api.ts`**

Replace the entire file contents:

```ts
import axios from "axios";

export type ApiError = {
  statusCode: number;
  message: string;
  code: string;
};

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    "message" in err &&
    "code" in err
  );
}

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (err) => {
    const data = err?.response?.data;
    if (data && typeof data === "object" && "statusCode" in data) {
      return Promise.reject(data as ApiError);
    }
    return Promise.reject(err);
  },
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm test -- --run api.test
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Fix `login-form.tsx`**

Replace the `catch` block at line 35 in `apps/web/src/components/auth/login-form.tsx`:

```ts
// Before:
} catch (err: any) {
  toast.error(err.message ?? "Failed to sign in");
}

// After:
} catch (err: unknown) {
  toast.error(isApiError(err) ? err.message : "Failed to sign in");
}
```

Add the import at the top of the file:

```ts
import { isApiError } from "@/lib/api";
```

- [ ] **Step 6: Fix `signup-form.tsx`**

There are two `catch` blocks. Replace both.

First catch (line ~38):

```ts
// Before:
} catch (err: any) {
  toast.error(err.message ?? "Failed to create account");
}

// After:
} catch (err: unknown) {
  toast.error(isApiError(err) ? err.message : "Failed to create account");
}
```

Second catch (line ~67):

```ts
// Before:
} catch (err: any) {
  toast.error(err.message ?? "Failed to resend email");
}

// After:
} catch (err: unknown) {
  toast.error(isApiError(err) ? err.message : "Failed to resend email");
}
```

Add the import at the top of the file:

```ts
import { isApiError } from "@/lib/api";
```

- [ ] **Step 7: Fix `create-workspace.tsx`**

Replace the `catch` block at line ~91 in `apps/web/src/routes/create-workspace.tsx`:

```ts
// Before:
} catch (err: any) {
  toast.error(
    err.message ?? "Failed to create workspace. Please try again.",
  );
}

// After:
} catch (err: unknown) {
  toast.error(
    isApiError(err) ? err.message : "Failed to create workspace. Please try again.",
  );
}
```

Add the import at the top of the file:

```ts
import { isApiError } from "@/lib/api";
```

- [ ] **Step 8: Run type-check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts \
  apps/web/src/components/auth/login-form.tsx \
  apps/web/src/components/auth/signup-form.tsx \
  apps/web/src/routes/create-workspace.tsx
git commit -m "feat(web): add isApiError guard and fix untyped catch blocks"
```

---

## Task 4: Extract router + 401 session-expiry redirect

**Files:**
- Create: `apps/web/src/lib/router.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/lib/api.ts`

The Axios interceptor lives outside React, so it cannot use `useNavigate`. Moving the router creation to `lib/router.ts` lets the interceptor import `router` directly and call `router.navigate`.

The 401 redirect is skipped for `better-auth` routes (`/api/auth/*`) because those return 401 for unauthenticated checks that are expected (e.g., the session probe on public pages).

- [ ] **Step 1: Create `apps/web/src/lib/router.ts`**

```ts
import { createRouter } from "@tanstack/react-router";
import { queryClient } from "./query-client";
import { routeTree } from "../routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface RouterContext {
    queryClient: typeof queryClient;
  }
}
```

- [ ] **Step 2: Update `apps/web/src/main.tsx`**

Replace the entire file contents:

```tsx
import "@orbit/ui/globals.css";
import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { router } from "./lib/router";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
```

- [ ] **Step 3: Update `apps/web/src/lib/api.ts` — add 401 redirect**

Replace the entire file contents:

```ts
import axios from "axios";
import { router } from "./router";

export type ApiError = {
  statusCode: number;
  message: string;
  code: string;
};

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    "message" in err &&
    "code" in err
  );
}

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (err) => {
    const url: string = err?.config?.url ?? "";
    const data = err?.response?.data;

    if (
      err?.response?.status === 401 &&
      !url.startsWith("/auth/")
    ) {
      router.navigate({ to: "/login" });
      return Promise.reject(data as ApiError);
    }

    if (data && typeof data === "object" && "statusCode" in data) {
      return Promise.reject(data as ApiError);
    }

    return Promise.reject(err);
  },
);
```

Note: the URL check is `/auth/` because the `axios` instance has `baseURL` ending in `/api`, so better-auth routes appear as `/auth/...` in `config.url` (which is the path relative to `baseURL`).

- [ ] **Step 4: Verify type-check and build**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Run all web tests**

```bash
cd apps/web && pnpm test -- --run
```

Expected: all existing tests PASS (the `api.test.ts` from Task 3 still passes).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/router.ts apps/web/src/main.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): extract router module and add 401 session-expiry redirect"
```

---

## Task 5: Global query error handler in QueryClient

**Files:**
- Modify: `apps/web/src/lib/query-client.ts`

Background queries that fail (e.g., a workspace data fetch when the network drops) have no inline error handling — they just fail silently. This adds a `QueryCache` `onError` handler that fires a Sonner toast for any query error that isn't a 401 (401s are already handled by the Axios interceptor redirect).

Mutations are excluded from the global handler because every mutation in the codebase uses `mutateAsync` inside a `try/catch` that toasts inline.

- [ ] **Step 1: Update `apps/web/src/lib/query-client.ts`**

Replace the entire file contents:

```ts
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "./api";
import { isApiError } from "./api";

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isApiError(error) && error.statusCode !== 401) {
        toast.error(error.message);
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: false,
    },
  },
});
```

- [ ] **Step 2: Verify type-check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Run all web tests**

```bash
cd apps/web && pnpm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/query-client.ts
git commit -m "feat(web): add global QueryCache error handler with toast fallback"
```

---

## Self-Review

**Spec coverage:**
1. ✅ Shared error codes — Task 1
2. ✅ Domain exception classes — Task 2
3. ✅ `isApiError` guard — Task 3
4. ✅ Fix `catch (err: any)` in all 4 locations — Task 3
5. ✅ 401 redirect — Task 4
6. ✅ QueryClient global error handler — Task 5

**Placeholder scan:** No TBDs. All code blocks are complete and compilable.

**Type consistency:**
- `isApiError` defined in Task 3, imported in Tasks 4 and 5 — name matches.
- `router` created in `lib/router.ts` in Task 4, imported in `api.ts` in same task — no drift.
- `AppException` defined in Task 2 — not yet used in a controller, but the class is complete and tested; usage comes in future feature tasks.
- `API_ERROR_CODES` defined in Task 1 — `AppException` in Task 2 accepts `string` (not `ApiErrorCode`) so it works with domain codes not yet in the shared const; this is intentional.
