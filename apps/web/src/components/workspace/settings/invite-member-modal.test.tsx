import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inviteMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
	useInviteMember: () => ({
		mutateAsync: inviteMock,
		isPending: false,
	}),
}));

const { InviteMemberModal } = await import("./invite-member-modal");

function renderModal(
	props: Partial<ComponentProps<typeof InviteMemberModal>> = {},
) {
	render(
		<InviteMemberModal
			organizationId="org_123"
			plan="free"
			pricePerSeat={null}
			billingInterval={null}
			{...props}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
}

function fillEmail(email = "colleague@example.com") {
	fireEvent.change(screen.getByLabelText("Email address"), {
		target: { value: email },
	});
}

describe("InviteMemberModal", () => {
	beforeEach(() => {
		inviteMock.mockReset();
		inviteMock.mockResolvedValue({});
	});

	it("sends free-plan invites immediately", async () => {
		renderModal();
		fillEmail();

		fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

		await waitFor(() => {
			expect(inviteMock).toHaveBeenCalledWith({
				organizationId: "org_123",
				email: "colleague@example.com",
				role: "member",
			});
		});
	});

	it("shows paid confirmation before sending an invite", async () => {
		renderModal({
			plan: "basic",
			pricePerSeat: 10,
			billingInterval: "monthly",
		});
		fillEmail();

		fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

		await waitFor(() => {
			expect(screen.getByText("Add a seat?")).toBeDefined();
		});
		expect(screen.getByText("$10 / seat / month")).toBeDefined();
		expect(inviteMock).not.toHaveBeenCalled();
	});

	it("confirms paid invite with the original email and role", async () => {
		renderModal({
			plan: "business",
			pricePerSeat: 15,
			billingInterval: "monthly",
		});
		fillEmail("paid@example.com");

		fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
		await waitFor(() => {
			expect(screen.getByText("Add a seat?")).toBeDefined();
		});
		fireEvent.click(screen.getByRole("button", { name: "Confirm & invite" }));

		await waitFor(() => {
			expect(inviteMock).toHaveBeenCalledWith({
				organizationId: "org_123",
				email: "paid@example.com",
				role: "member",
			});
		});
	});

	it("back preserves form values", async () => {
		renderModal({
			plan: "basic",
			pricePerSeat: 10,
			billingInterval: "monthly",
		});
		fillEmail("kept@example.com");

		fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
		await waitFor(() => {
			expect(screen.getByText("Add a seat?")).toBeDefined();
		});
		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		expect(screen.getByDisplayValue("kept@example.com")).toBeDefined();
	});

	it("uses yearly copy for yearly paid subscriptions", async () => {
		renderModal({
			plan: "business",
			pricePerSeat: 180,
			billingInterval: "yearly",
		});
		fillEmail();

		fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

		await waitFor(() => {
			expect(screen.getByText("$180 / seat / year")).toBeDefined();
		});
	});
});
