import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
	useSession: () => ({
		data: { user: { name: "Thinh", email: "t@x.com", image: null } },
	}),
	useUpdateUser: () => ({ mutate: updateMock, isPending: false }),
	useDeleteAccount: () => ({ mutate: deleteMock, isPending: false }),
}));

// Import AFTER vi.mock so the mock is applied
const { ProfileSettings } = await import("./profile-settings");

describe("ProfileSettings", () => {
	beforeEach(() => {
		updateMock.mockClear();
		deleteMock.mockClear();
	});

	it("renders profile fields", () => {
		render(<ProfileSettings />);
		expect(screen.getByDisplayValue("Thinh")).toBeDefined();
		expect(screen.getByDisplayValue("t@x.com")).toBeDefined();
	});

	it("calls updateUser with the new name on blur when it changed", () => {
		render(<ProfileSettings />);
		const input = screen.getByDisplayValue("Thinh") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "Thinh Le" } });
		fireEvent.blur(input);
		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(updateMock.mock.calls[0][0]).toEqual({ name: "Thinh Le" });
	});

	it("does NOT call updateUser on blur when the value is unchanged", () => {
		render(<ProfileSettings />);
		const input = screen.getByDisplayValue("Thinh") as HTMLInputElement;
		fireEvent.blur(input);
		expect(updateMock).not.toHaveBeenCalled();
	});
});
