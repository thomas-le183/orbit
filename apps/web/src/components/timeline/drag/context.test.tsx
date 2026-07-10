import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DragRangeProvider, DragRangePublisher, useDragRange } from "./context";

function Probe() {
	const drag = useDragRange();
	return (
		<span data-testid="probe">
			{drag ? `${drag.range.from}-${drag.range.to}` : "none"}
		</span>
	);
}

describe("useDragRange", () => {
	it("defaults to null with no provider", () => {
		render(<Probe />);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});

	it("exposes a published range", () => {
		render(
			<DragRangeProvider>
				<DragRangePublisher range={{ from: 10, to: 20 }} pointerX={100} />
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("10-20");
	});

	it("exposes null when the range is published as null", () => {
		render(
			<DragRangeProvider>
				<DragRangePublisher range={null} pointerX={null} />
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});

	it("exposes null when only a pointer (no range) is published", () => {
		render(
			<DragRangeProvider>
				<DragRangePublisher range={null} pointerX={100} />
				<Probe />
			</DragRangeProvider>,
		);
		expect(screen.getByTestId("probe").textContent).toBe("none");
	});
});
