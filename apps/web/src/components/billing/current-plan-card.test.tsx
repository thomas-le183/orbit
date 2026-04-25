import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mutateMock = vi.fn();

vi.mock("@/hooks/use-billing", () => ({
	useOrgSubscription: () => ({
		data: {
			plan: "business",
			planLabel: "Business",
			usage: { members: { current: 8, limit: -1 } },
			subscription: {
				status: "active",
				currentPeriodEnd: new Date("2026-05-20"),
				cancelAtPeriodEnd: false,
			},
		},
		isLoading: false,
	}),
	usePortal: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ orgSlug: "test-org" }),
}));

const { CurrentPlanCard } = await import("./current-plan-card");

describe("CurrentPlanCard", () => {
	it("shows the plan label", () => {
		render(<CurrentPlanCard />);
		expect(screen.getByText("Business")).toBeDefined();
	});

	it("shows Manage subscription button when subscription exists", () => {
		render(<CurrentPlanCard />);
		expect(
			screen.getByRole("button", { name: /manage subscription/i }),
		).toBeDefined();
	});
});
