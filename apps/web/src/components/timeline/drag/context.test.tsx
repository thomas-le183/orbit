import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DragRangeProvider, useDragRange } from "./context";

function Probe() {
	const range = useDragRange();
	return <span data-testid="probe">{range ? `${range.from}-${range.to}` : "none"}</span>;
}

describe("useDragRange", () => {
	it("defaults to null with no provider", () => {
		render(<Probe />);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});

	it("exposes the provided range", () => {
		render(
			<DragRangeProvider range={{ from: 10, to: 20 }}>
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("10-20");
	});

	it("exposes null when the provider passes null", () => {
		render(
			<DragRangeProvider range={null}>
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});
});
