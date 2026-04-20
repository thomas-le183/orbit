import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mutateMock = vi.fn();

vi.mock("@/hooks/use-billing", () => ({
	useOrgSubscription: () => ({
		data: {
			tier: "team",
			tierLabel: "Startup",
			usage: { members: { current: 8, limit: 25 } },
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
	it("shows the tier label", () => {
		render(<CurrentPlanCard />);
		expect(screen.getByText("Startup")).toBeDefined();
	});

	it("shows member usage", () => {
		render(<CurrentPlanCard />);
		expect(screen.getByText(/8\s*\/\s*25/)).toBeDefined();
	});

	it("shows Manage subscription button when subscription exists", () => {
		render(<CurrentPlanCard />);
		expect(
			screen.getByRole("button", { name: /manage subscription/i }),
		).toBeDefined();
	});
});
