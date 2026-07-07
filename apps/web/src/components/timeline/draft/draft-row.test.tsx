import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineProvider } from "../controller/context";
import { DraftLane, DraftTableCell } from "./draft-row";
import { DraftTaskProvider, useDraftTask } from "./use-draft-task";

const mutate = vi.fn();
vi.mock("@/hooks/use-tasks", () => ({
	useCreateTask: () => ({ mutate, isPending: false }),
}));

const withProvider = (children: ReactNode) => (
	<TimelineProvider weekStart={1}>
		<DraftTaskProvider projectId="p1" enabled>
			{children}
		</DraftTaskProvider>
	</TimelineProvider>
);

function SeedDates() {
	const { setDates } = useDraftTask();
	useEffect(() => setDates("2026-07-01", "2026-07-05"), [setDates]);
	return null;
}

describe("DraftRow", () => {
	beforeEach(() => mutate.mockReset());

	it("commits a name on Enter", () => {
		render(withProvider(<DraftTableCell rowIndex={0} />));
		const input = screen.getByLabelText(/new task name/i);
		fireEvent.change(input, { target: { value: "Beta" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(mutate).toHaveBeenCalledWith({ name: "Beta" }, expect.any(Object));
	});

	it("clears the name on Escape", () => {
		render(withProvider(<DraftTableCell rowIndex={0} />));
		const input = screen.getByLabelText(/new task name/i) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "Beta" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input.value).toBe("");
	});

	it("shows the sketched date range in the Dates column", () => {
		render(
			withProvider(
				<>
					<SeedDates />
					<DraftTableCell rowIndex={0} />
				</>,
			),
		);
		expect(screen.getByText(/2026-07-01 → 2026-07-05/)).toBeInTheDocument();
	});

	it("renders the ghost bar in the lane when dates are set", () => {
		render(
			withProvider(
				<>
					<SeedDates />
					<DraftLane rowIndex={0} />
				</>,
			),
		);
		expect(screen.getByTestId("timeline-draft-preview")).toBeInTheDocument();
	});

	it("renders no ghost bar when no dates are set", () => {
		render(withProvider(<DraftLane rowIndex={0} />));
		expect(screen.queryByTestId("timeline-draft-preview")).toBeNull();
	});
});
