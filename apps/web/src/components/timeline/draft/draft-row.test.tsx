import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineProvider } from "../controller/context";
import {
	DragRangeProvider,
	type DragRangeState,
	useDragRange,
} from "../drag/context";
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

	it("abandons the draft on Escape mid-drag", () => {
		render(withProvider(<DraftLane rowIndex={0} />));
		const lane = screen.getByTestId("timeline-draft-lane");

		fireEvent.pointerDown(lane, { clientX: 10 });
		fireEvent.pointerMove(window, { clientX: 200 });
		expect(screen.getByTestId("timeline-draft-preview")).toBeInTheDocument();

		fireEvent.keyDown(window, { key: "Escape" });
		expect(screen.queryByTestId("timeline-draft-preview")).toBeNull();

		// The release that follows must not re-apply the abandoned range.
		fireEvent.pointerUp(window, { clientX: 200 });
		expect(screen.queryByTestId("timeline-draft-preview")).toBeNull();
	});

	it("publishes the sketched range to the header while the create-drag is live", () => {
		const seen: (DragRangeState | null)[] = [];
		function Probe() {
			seen.push(useDragRange());
			return null;
		}
		render(
			withProvider(
				<DragRangeProvider>
					<Probe />
					<DraftLane rowIndex={0} />
				</DragRangeProvider>,
			),
		);
		const lane = screen.getByTestId("timeline-draft-lane");

		fireEvent.pointerDown(lane, { clientX: 10 });
		fireEvent.pointerMove(window, { clientX: 200 });
		const live = seen.at(-1);
		expect(live).not.toBeNull();
		expect(live?.pointerX).toBe(200);
		expect(live?.range.to).toBeGreaterThan(live?.range.from ?? 0);

		// Releasing ends the gesture: the axis feedback clears even though the
		// dashed ghost stays put until the name is committed or cancelled.
		fireEvent.pointerUp(window, { clientX: 200 });
		expect(seen.at(-1)).toBeNull();
		expect(screen.getByTestId("timeline-draft-preview")).toBeInTheDocument();
	});
});
