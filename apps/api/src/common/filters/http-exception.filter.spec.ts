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
    // Access private logger for spy — intentional test-only pattern
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
      [400, "BAD_REQUEST", new BadRequestException("bad")],
      [401, "UNAUTHORIZED", new UnauthorizedException("unauth")],
      [403, "FORBIDDEN", new ForbiddenException("forbidden")],
      [404, "NOT_FOUND", new NotFoundException("not found")],
      [409, "CONFLICT", new HttpException("conflict", 409)],
      [422, "UNPROCESSABLE_ENTITY", new HttpException("unprocessable", 422)],
      [429, "TOO_MANY_REQUESTS", new HttpException("too many", 429)],
      [500, "INTERNAL_SERVER_ERROR", new HttpException("server error", 500)],
      [418, "HTTP_418", new HttpException("teapot", 418)],
    ])("maps status %i to code %s", (statusCode, code, exception) => {
      const rowJson = jest.fn();
      const ctx = makeContext(rowJson);
      filter.catch(exception, ctx);
      expect(rowJson).toHaveBeenCalledWith(
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
