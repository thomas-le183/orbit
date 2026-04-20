import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow } from "./settings-row";

describe("SettingsRow", () => {
	it("renders label, hint, and control", () => {
		render(
			<SettingsRow label="Name" hint="Your name">
				<input data-testid="name-input" />
			</SettingsRow>,
		);
		expect(screen.getByText("Name")).toBeDefined();
		expect(screen.getByText("Your name")).toBeDefined();
		expect(screen.getByTestId("name-input")).toBeDefined();
	});

	it("omits the hint when not provided", () => {
		render(
			<SettingsRow label="Name">
				<input />
			</SettingsRow>,
		);
		expect(screen.queryByText(/your name/i)).toBeNull();
	});

	it("shows Saved indicator when saved prop is true", () => {
		render(
			<SettingsRow label="Name" saved>
				<input />
			</SettingsRow>,
		);
		expect(screen.getByText(/saved/i)).toBeDefined();
	});

	it("hides Saved indicator when saved is false or omitted", () => {
		render(
			<SettingsRow label="Name">
				<input />
			</SettingsRow>,
		);
		expect(screen.queryByText(/saved/i)).toBeNull();
	});
});
