import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TimelineProvider } from "../controller/context";
import { RowSelectionProvider } from "../selection/context";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

function renderTable() {
	return render(
		<TimelineProvider initialZoom="weeks">
			<RowSelectionProvider>
				<TimelineTableHeader />
				<TimelineTable />
			</RowSelectionProvider>
		</TimelineProvider>,
	);
}

describe("TimelineTable", () => {
	it("renders one row cell per timeline item row", () => {
		const { container } = renderTable();
		expect(
			container.querySelectorAll("[data-testid='timeline-table-row']").length,
		).toBeGreaterThan(0);
	});

	it("positions each row by its rowIndex (first row at the top padding)", () => {
		const { container } = renderTable();
		const first = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		expect(first?.style.top).toBe("7px");
	});

	it("selects a single row on click", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rows[0]);
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("false");
	});

	it("shift-click selects a contiguous range", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.click(rows[0]);
		await user.keyboard("{Shift>}");
		await user.click(rows[2]);
		await user.keyboard("{/Shift}");
		expect(rows[0].getAttribute("data-selected")).toBe("true");
		expect(rows[1].getAttribute("data-selected")).toBe("true");
		expect(rows[2].getAttribute("data-selected")).toBe("true");
	});

	it("header checkbox selects all rows", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		await user.click(screen.getByTestId("timeline-select-all"));
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		expect(
			[...rows].every((r) => r.getAttribute("data-selected") === "true"),
		).toBe(true);
	});

	it("applies a hover background while the pointer is over a row", async () => {
		const user = userEvent.setup();
		const { container } = renderTable();
		const rows = container.querySelectorAll<HTMLElement>(
			"[data-testid='timeline-table-row']",
		);
		await user.hover(rows[1]);
		expect(rows[1].className).toContain("bg-muted/50");
		await user.unhover(rows[1]);
		expect(rows[1].className).not.toContain("bg-muted/50");
	});
});
