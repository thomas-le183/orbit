import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import TaskHoverCard from "./task-hover-card";

function task(partial: Partial<TimelineItem> = {}): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "Ship the thing",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-04",
		color: "#3b82f6",
		estimatedTime: 960, // 16h over 4 inclusive days → 4h/day
		progress: 40,
		status: "in_progress",
		assignee: { id: "u1", name: "Ana Alpha", avatarUrl: "" },
		...partial,
	};
}

describe("TaskHoverCard", () => {
	it("shows the full name, status, assignee, span, and both effort figures", () => {
		render(<TaskHoverCard item={task()} />);

		expect(screen.getByText("Ship the thing")).toBeInTheDocument();
		expect(screen.getByText("In progress")).toBeInTheDocument();
		expect(screen.getByText("Ana Alpha")).toBeInTheDocument();
		// 4-day inclusive span, same-year so the year folds to the end.
		expect(screen.getByText("Jun 1 → Jun 4, 2026 · 4d")).toBeInTheDocument();
		// Total and per-day (16h total, 4h/day).
		expect(screen.getByText("16h · 4h/day")).toBeInTheDocument();
		expect(screen.getByText("40%")).toBeInTheDocument();
	});

	it("drops the per-day figure for a single-day task", () => {
		render(
			<TaskHoverCard
				item={task({
					startDate: "2026-06-02",
					endDate: "2026-06-02",
					estimatedTime: 120,
				})}
			/>,
		);
		expect(screen.getByText("2h")).toBeInTheDocument();
		expect(screen.queryByText(/\/day/)).not.toBeInTheDocument();
		expect(screen.getByText("Jun 2, 2026")).toBeInTheDocument();
	});

	it("omits effort and progress for a milestone and marks its type", () => {
		render(
			<TaskHoverCard
				item={task({
					kind: "milestone",
					name: "Launch",
					startDate: "2026-06-10",
					endDate: "2026-06-10",
					estimatedTime: undefined,
					progress: undefined,
					status: undefined,
				})}
			/>,
		);
		expect(screen.getByText("Launch")).toBeInTheDocument();
		expect(screen.getByText("Milestone")).toBeInTheDocument();
		expect(screen.getByText("Jun 10, 2026")).toBeInTheDocument();
		// No effort/per-day and no progress figure on a milestone.
		expect(screen.queryByText(/\/day/)).not.toBeInTheDocument();
		expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
	});

	it("carries the year on both ends of a cross-year span", () => {
		render(
			<TaskHoverCard
				item={task({ startDate: "2025-12-30", endDate: "2026-01-02" })}
			/>,
		);
		expect(
			screen.getByText("Dec 30, 2025 → Jan 2, 2026 · 4d"),
		).toBeInTheDocument();
	});
});
