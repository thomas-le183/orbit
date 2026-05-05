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

	it("message property reflects the constructor message argument", () => {
		const ex = new AppException("FORBIDDEN", "No access", 403);
		expect(ex.message).toBe("No access");
	});
});
