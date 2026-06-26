import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TimelineContainer from "./index";

describe("TimelineContainer", () => {
	it("mounts the header, grid, now-line and zoom control together", () => {
		const { container } = render(<TimelineContainer />);
		expect(container.querySelector("[data-testid='timeline-header-top']")).not.toBeNull();
		expect(container.querySelector("[data-testid='timeline-now-line']")).not.toBeNull();
		// zoom control buttons (4 zoom level options)
		expect(container.querySelectorAll("button[data-slot='toggle-group-item']").length).toBe(4);
	});
});
