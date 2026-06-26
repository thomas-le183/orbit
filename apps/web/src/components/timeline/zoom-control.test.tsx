import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TimelineProvider } from "./controller/context";
import { useZoomLevel } from "./controller/hooks";
import ZoomControl from "./zoom-control";

function ZoomReadout() {
	const [zoom] = useZoomLevel();
	return <span data-testid="zoom-readout">{zoom}</span>;
}

describe("ZoomControl", () => {
	it("renders a button per zoom level", () => {
		render(
			<TimelineProvider initialZoom="weeks">
				<ZoomControl />
			</TimelineProvider>,
		);
		for (const label of ["Weeks", "Months", "Quarters", "Years"]) {
			expect(screen.getByRole("button", { name: label })).toBeTruthy();
		}
	});

	it("changes the controller zoom level when clicked", async () => {
		const user = userEvent.setup();
		render(
			<TimelineProvider initialZoom="weeks">
				<ZoomControl />
				<ZoomReadout />
			</TimelineProvider>,
		);
		await user.click(screen.getByRole("button", { name: "Quarters" }));
		expect(screen.getByTestId("zoom-readout").textContent).toBe("quarters");
	});
});
