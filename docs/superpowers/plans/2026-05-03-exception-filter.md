# Exception Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global NestJS exception filter that serializes all errors into a consistent `{ statusCode, message, code }` JSON shape with domain-specific i18n-ready error codes.

**Architecture:** A single `@Catch()` filter in `apps/api/src/common/filters/` intercepts every thrown exception. `HttpException` instances are normalized using their status and structured body; unexpected errors become opaque 500s that are logged server-side. The frontend `ApiError` type is updated to match.

**Tech Stack:** NestJS `ExceptionFilter`, `HttpException`, `Logger`; Jest for unit tests; TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/common/filters/http-exception.filter.ts` | Catch-all exception filter |
| Create | `apps/api/src/common/filters/http-exception.filter.spec.ts` | Unit tests for the filter |
| Modify | `apps/api/src/main.ts` | Register filter globally |
| Modify | `apps/web/src/lib/api.ts` | Update `ApiError` type |

---

### Task 1: Write the failing tests for the filter

**Files:**
- Create: `apps/api/src/common/filters/http-exception.filter.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
// apps/api/src/common/filters/http-exception.filter.spec.ts
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

function makeContext(jsonFn = jest.fn()) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: jest.fn().mockReturnThis(),
        json: jsonFn,
      }),
    }),
  } as any;
}

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;
  let json: jest.Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    json = jest.fn();
    jest.spyOn(filter["logger"], "error").mockImplementation(() => {});
  });

  describe("HttpException — string response", () => {
    it("returns statusCode, message, and HTTP-derived code", () => {
      const ctx = makeContext(json);
      filter.catch(new NotFoundException("Organization not found"), ctx);
      expect(json).toHaveBeenCalledWith({
        statusCode: 404,
        message: "Organization not found",
        code: "NOT_FOUND",
      });
    });
  });

  describe("HttpException — structured response with code", () => {
    it("uses the domain-specific code from the exception body", () => {
      const ctx = makeContext(json);
      filter.catch(
        new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found" }),
        ctx,
      );
      expect(json).toHaveBeenCalledWith({
        statusCode: 404,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    });
  });

  describe("HttpException — ValidationPipe array message", () => {
    it("joins message array into a single string", () => {
      const ctx = makeContext(json);
      filter.catch(
        new BadRequestException({
          message: ["name must not be empty", "email must be an email"],
          error: "Bad Request",
          statusCode: 400,
        }),
        ctx,
      );
      expect(json).toHaveBeenCalledWith({
        statusCode: 400,
        message: "name must not be empty; email must be an email",
        code: "BAD_REQUEST",
      });
    });
  });

  describe("HttpException — code fallback map", () => {
    it.each([
      [new BadRequestException("bad"), 400, "BAD_REQUEST"],
      [new UnauthorizedException("unauth"), 401, "UNAUTHORIZED"],
      [new ForbiddenException("forbidden"), 403, "FORBIDDEN"],
      [new NotFoundException("not found"), 404, "NOT_FOUND"],
      [new HttpException("conflict", 409), 409, "CONFLICT"],
      [new HttpException("unprocessable", 422), 422, "UNPROCESSABLE_ENTITY"],
      [new HttpException("too many", 429), 429, "TOO_MANY_REQUESTS"],
      [new HttpException("server error", 500), 500, "INTERNAL_SERVER_ERROR"],
      [new HttpException("teapot", 418), 418, "HTTP_418"],
    ])("maps status %s to code %s", (exception, statusCode, code) => {
      const ctx = makeContext(json);
      filter.catch(exception, ctx);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode, code }),
      );
    });
  });

  describe("Non-HttpException", () => {
    it("returns 500 with opaque message and logs the error", () => {
      const ctx = makeContext(json);
      const err = new Error("DB connection refused");
      filter.catch(err, ctx);
      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(filter["logger"].error).toHaveBeenCalled();
    });

    it("handles non-Error throws gracefully", () => {
      const ctx = makeContext(json);
      filter.catch("some string was thrown", ctx);
      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      });
    });
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail with "Cannot find module"**

```bash
cd apps/api && pnpm test -- --testPathPattern="http-exception.filter.spec"
```

Expected output: `Cannot find module './http-exception.filter'`

---

### Task 2: Implement the filter

**Files:**
- Create: `apps/api/src/common/filters/http-exception.filter.ts`

- [ ] **Step 1: Create the filter**

```ts
// apps/api/src/common/filters/http-exception.filter.ts
import {
  type ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

const STATUS_CODE_MAP: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      let message: string;
      let code: string;

      if (typeof res === "string") {
        message = res;
        code = STATUS_CODE_MAP[status] ?? `HTTP_${status}`;
      } else {
        const body = res as Record<string, unknown>;
        const raw = body.message;
        message = Array.isArray(raw)
          ? (raw as string[]).join("; ")
          : typeof raw === "string"
            ? raw
            : exception.message;
        code =
          typeof body.code === "string"
            ? body.code
            : (STATUS_CODE_MAP[status] ?? `HTTP_${status}`);
      }

      response.status(status).json({ statusCode: status, message, code });
      return;
    }

    this.logger.error(
      "Unhandled exception",
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(500).json({
      statusCode: 500,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
```

- [ ] **Step 2: Run the tests — verify they all pass**

```bash
cd apps/api && pnpm test -- --testPathPattern="http-exception.filter.spec"
```

Expected output: all tests pass, no failures.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/filters/http-exception.filter.ts apps/api/src/common/filters/http-exception.filter.spec.ts
git commit -m "feat(api): add global HttpExceptionFilter with domain error codes"
```

---

### Task 3: Register the filter globally

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Import and register the filter before `useGlobalPipes`**

In `apps/api/src/main.ts`, add the import and registration. The file currently reads:

```ts
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { LatencyInterceptor } from "./common/interceptors/latency.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // ...
```

Update it to:

```ts
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LatencyInterceptor } from "./common/interceptors/latency.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  app.setGlobalPrefix("api");

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // rest of bootstrap unchanged
```

- [ ] **Step 2: Typecheck to confirm no import errors**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(api): register HttpExceptionFilter globally"
```

---

### Task 4: Update the frontend ApiError type

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Replace `error?: string` with `code: string`**

Current content of `apps/web/src/lib/api.ts`:

```ts
import axios from "axios";

export type ApiError = {
  statusCode: number;
  message: string;
  error?: string;
};

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

Update to:

```ts
import axios from "axios";

export type ApiError = {
  statusCode: number;
  message: string;
  code: string;
};

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

- [ ] **Step 2: Typecheck the frontend**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors. (Existing call sites use `err.message` — they are unaffected. No call site references `err.error`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): update ApiError type to use code instead of error"
```
