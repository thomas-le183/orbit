import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TimelineEmptyState from "./timeline-empty-state";

vi.mock("./create-task-dialog", () => ({
	CreateTaskDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-task-dialog-open</div> : null,
}));

describe("TimelineEmptyState", () => {
	it("renders the empty heading and a create-task button", () => {
		render(<TimelineEmptyState projectId="p1" />);
		expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /create task/i }),
		).toBeInTheDocument();
	});

	it("opens the create-task dialog when the button is clicked", () => {
		render(<TimelineEmptyState projectId="p1" />);
		expect(screen.queryByText("create-task-dialog-open")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		expect(screen.getByText("create-task-dialog-open")).toBeInTheDocument();
	});
});
