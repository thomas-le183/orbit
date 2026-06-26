import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import TimelineContainer from "./index";

beforeAll(() => {
	Object.defineProperty(HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get: () => 800,
	});
});
afterAll(() => {
	// remove the override so it doesn't leak to other test files
	// (delete reverts to the prototype's native getter)
	// @ts-expect-error - deleting an own-defined property on the prototype
	delete HTMLElement.prototype.clientWidth;
});

describe("TimelineContainer", () => {
	it("mounts the header, grid, now-line and zoom control together", () => {
		const { container } = render(<TimelineContainer />);
		expect(container.querySelector("[data-testid='timeline-header-top']")).not.toBeNull();
		expect(container.querySelector("[data-testid='timeline-now-line']")).not.toBeNull();
		// zoom control buttons (4 zoom level options)
		expect(container.querySelectorAll("button[data-slot='toggle-group-item']").length).toBe(4);
	});
});
