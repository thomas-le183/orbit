import {
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@orbit/ui/components/table";
import { VirtualizedTable } from "@orbit/ui/components/virtualized-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

type Row = { id: string; name: string };

function renderTable(count: number) {
	const rows: Row[] = Array.from({ length: count }, (_, i) => ({
		id: `r${i}`,
		name: `Row ${i}`,
	}));
	return render(
		<VirtualizedTable
			rows={rows}
			rowKey={(r) => r.id}
			columnCount={1}
			maxHeight={200}
			header={
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
					</TableRow>
				</TableHeader>
			}
			renderRow={(r) => (
				<TableRow key={r.id} data-testid="member-row">
					<TableCell>{r.name}</TableCell>
				</TableRow>
			)}
		/>,
	);
}

describe("VirtualizedTable", () => {
	it("renders the header and every row when the viewport is unmeasured (jsdom)", () => {
		const { container } = renderTable(50);
		expect(screen.getByText("Name")).toBeInTheDocument();
		expect(
			container.querySelectorAll("[data-testid='member-row']").length,
		).toBe(50);
	});

	it("omits the spacer rows while unmeasured so layout matches a plain table", () => {
		const { container } = renderTable(50);
		expect(
			container.querySelector("[data-testid='virtualized-table-spacer-top']"),
		).toBeNull();
		expect(
			container.querySelector(
				"[data-testid='virtualized-table-spacer-bottom']",
			),
		).toBeNull();
	});

	it("renders an empty body without error", () => {
		const { container } = renderTable(0);
		expect(
			container.querySelectorAll("[data-testid='member-row']").length,
		).toBe(0);
	});
});
