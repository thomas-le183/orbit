import { describe, expect, it } from "vitest";
import { resolveModule } from "./navigation";

describe("resolveModule", () => {
	it("resolves project routes to the Home module", () => {
		const config = resolveModule("/acme/projects/p1", "acme");
		expect(config?.title).toBe("Home");
	});
});
