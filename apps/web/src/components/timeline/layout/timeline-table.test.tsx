import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineProvider } from "../controller/context";
import TimelineTable from "./timeline-table";

describe("TimelineTable", () => {
	it("renders one row cell per timeline item row", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<TimelineTable />
			</TimelineProvider>,
		);
		const cells = container.querySelectorAll(
			"[data-testid='timeline-table-row']",
		);
		expect(cells.length).toBeGreaterThan(0);
	});

	it("positions each row by its rowIndex (first row at the top padding)", () => {
		const { container } = render(
			<TimelineProvider initialZoom="weeks">
				<TimelineTable />
			</TimelineProvider>,
		);
		const first = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		// ROW_PADDING = 7 → first row's top is 7px
		expect(first?.style.top).toBe("7px");
	});
});
