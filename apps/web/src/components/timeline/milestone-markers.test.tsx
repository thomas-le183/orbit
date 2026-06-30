import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneMarkers from "./milestone-markers";

vi.mock("./data/context", () => ({
	useTimelineData: () => ({
		milestoneMarkers: [
			{ id: "m1", date: "2026-07-01", name: "Launch", color: "#abc" },
			{ id: "m2", date: "2026-08-01", name: "GA", color: "#def" },
		],
	}),
}));
vi.mock("./controller/context", () => ({
	useTimelineController: () => ({ today: 0 }),
}));
vi.mock("./controller/hooks", () => ({
	useHorizontalPercentageOffset: () => ({ getPercentageOffset: () => 50 }),
}));

describe("MilestoneMarkers", () => {
	it("renders a marker per milestone with an accessible name", () => {
		render(<MilestoneMarkers />);
		const markers = screen.getAllByTestId("timeline-milestone-marker");
		expect(markers).toHaveLength(2);
		expect(screen.getByLabelText("Launch")).toBeInTheDocument();
		expect(screen.getByLabelText("GA")).toBeInTheDocument();
	});
});
