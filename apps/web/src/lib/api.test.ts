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
