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
	it("shows the current zoom level on the trigger button", () => {
		render(
			<TimelineProvider initialZoom="weeks">
				<ZoomControl />
			</TimelineProvider>,
		);
		expect(screen.getByRole("button", { name: /weeks/i })).toBeTruthy();
	});

	it("changes the controller zoom level when an option is selected", async () => {
		const user = userEvent.setup();
		render(
			<TimelineProvider initialZoom="weeks">
				<ZoomControl />
				<ZoomReadout />
			</TimelineProvider>,
		);
		await user.click(screen.getByRole("button", { name: /weeks/i }));
		await user.click(screen.getByRole("menuitemradio", { name: "Quarters" }));
		expect(screen.getByTestId("zoom-readout").textContent).toBe("quarters");
	});
});
