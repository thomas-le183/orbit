import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineData } from "./data/context";
import TimelineView from "./timeline-view";

vi.mock("./data/context", () => ({ useTimelineData: vi.fn() }));
vi.mock("./timeline-empty-state", () => ({
	default: () => <div>empty-state</div>,
}));
vi.mock("./layout/split-layout", () => ({
	default: ({ onNewTask }: { onNewTask?: () => void }) => (
		<div>{onNewTask ? "split-layout-with-new-task" : "split-layout"}</div>
	),
}));
vi.mock("./layout/timeline-table", () => ({
	default: () => null,
	TimelineTableHeader: () => null,
}));
vi.mock("./timeline-skeleton", () => ({
	default: () => <div>skeleton</div>,
}));
vi.mock("./create-task-dialog", () => ({
	CreateTaskDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-task-dialog-open</div> : null,
}));

const dataMock = useTimelineData as unknown as ReturnType<typeof vi.fn>;

function value(overrides: Record<string, unknown>) {
	return {
		items: [],
		updateItem: vi.fn(),
		moveDays: vi.fn(),
		undatedTaskRows: [],
		milestoneMarkers: [],
		isLoading: false,
		isError: false,
		projectId: undefined,
		...overrides,
	};
}

describe("TimelineView", () => {
	beforeEach(() => vi.clearAllMocks());

	it("shows the empty state for a project with zero tasks", () => {
		dataMock.mockReturnValue(
			value({ projectId: "p1", items: [], undatedTaskRows: [] }),
		);
		render(<TimelineView />);
		expect(screen.getByText("empty-state")).toBeInTheDocument();
		expect(screen.queryByText("split-layout")).toBeNull();
	});

	it("shows the timeline when the project has tasks", () => {
		dataMock.mockReturnValue(value({ projectId: "p1", items: [{ id: "t1" }] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout-with-new-task")).toBeInTheDocument();
		expect(screen.queryByText("empty-state")).toBeNull();
	});

	it("passes onNewTask to SplitLayout when a project has tasks", () => {
		dataMock.mockReturnValue(value({ projectId: "p1", items: [{ id: "t1" }] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout-with-new-task")).toBeInTheDocument();
	});

	it("does not pass onNewTask to SplitLayout in seed mode", () => {
		dataMock.mockReturnValue(value({ projectId: undefined, items: [] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
		expect(screen.queryByText("split-layout-with-new-task")).toBeNull();
	});

	it("shows the timeline in seed mode (no projectId) even with zero items", () => {
		dataMock.mockReturnValue(value({ projectId: undefined, items: [] }));
		render(<TimelineView />);
		expect(screen.getByText("split-layout")).toBeInTheDocument();
	});

	it("shows the skeleton while a project is loading", () => {
		dataMock.mockReturnValue(
			value({ projectId: "p1", items: [], isLoading: true }),
		);
		render(<TimelineView />);
		expect(screen.getByText("skeleton")).toBeInTheDocument();
		expect(screen.queryByText("split-layout")).toBeNull();
		expect(screen.queryByText("empty-state")).toBeNull();
	});
});
