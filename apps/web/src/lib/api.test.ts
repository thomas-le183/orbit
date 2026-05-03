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

  it("returns false for undefined", () => {
    expect(isApiError(undefined)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isApiError("error string")).toBe(false);
  });

  it("returns false when message is missing", () => {
    expect(isApiError({ statusCode: 404, code: "NOT_FOUND" })).toBe(false);
  });

  it("returns false when code is missing", () => {
    expect(isApiError({ statusCode: 404, message: "Not found" })).toBe(false);
  });

  it("returns false when statusCode is a string instead of number", () => {
    expect(isApiError({ statusCode: "404", message: "Not found", code: "NOT_FOUND" })).toBe(false);
  });
});
