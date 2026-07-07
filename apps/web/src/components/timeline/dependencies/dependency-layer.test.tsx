import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";

const fixtureItems: TimelineItem[] = [
	{
		id: "t-a",
		kind: "task",
		name: "Task A",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-05",
		color: "#6366f1",
	},
	{
		id: "t-b",
		kind: "task",
		name: "Task B",
		parentId: null,
		startDate: "2026-06-10",
		endDate: "2026-06-14",
		color: "#6366f1",
	},
];

import { TimelineProvider, useTimelineController } from "../controller/context";
import { useTimelineData } from "../data/context";
import { DependencyLayer } from "./dependency-layer";

// DependencyLayer reads everything it needs from useTimelineData; mock it
// directly with the seed items plus one dependency between the first two.
vi.mock("../data/context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../data/context")>();
	return { ...actual, useTimelineData: vi.fn() };
});

function SizeViewport({ width }: { width: number }) {
	const { setViewportWidth } = useTimelineController();
	useEffect(() => setViewportWidth(width), [setViewportWidth, width]);
	return null;
}

function renderLayer() {
	const [a, b] = fixtureItems;
	(useTimelineData as ReturnType<typeof vi.fn>).mockReturnValue({
		items: fixtureItems,
		undatedTaskRows: [],
		milestoneMarkers: [],
		isLoading: false,
		isError: false,
		projectId: undefined,
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		scheduleTask: vi.fn(),
		dependencies: [
			{
				id: "d1",
				projectId: "p1",
				predecessorId: a.id,
				successorId: b.id,
				type: "FS",
			},
		],
		createDependency: vi.fn(),
		deleteDependency: vi.fn(),
	});
	return render(
		<TimelineProvider initialZoom="weeks">
			<SizeViewport width={100000} />
			<DependencyLayer draft={{}} linkDraft={null} />
		</TimelineProvider>,
	);
}

describe("DependencyLayer", () => {
	it("renders one connector path per dependency", () => {
		const { container } = renderLayer();
		expect(
			container.querySelectorAll("[data-testid='dependency-link']").length,
		).toBe(1);
	});
});
