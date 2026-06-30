import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TimelineSkeleton from "./timeline-skeleton";

describe("TimelineSkeleton", () => {
	it("renders 7 skeleton rows", () => {
		const { container } = render(<TimelineSkeleton />);
		expect(
			container.querySelectorAll("[data-testid='timeline-skeleton-row']")
				.length,
		).toBe(7);
	});

	it("marks the container aria-busy", () => {
		const { container } = render(<TimelineSkeleton />);
		expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
	});

	it("exposes a 'Loading tasks' accessible label", () => {
		render(<TimelineSkeleton />);
		expect(screen.getByText("Loading tasks")).toBeInTheDocument();
	});
});
