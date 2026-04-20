import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-billing", () => ({
	useOrgSubscription: () => ({
		data: {
			tier: "free",
			tierLabel: "Hobby",
			usage: { members: { current: 2, limit: 5 } },
			subscription: null,
		},
		isLoading: false,
	}),
	usePortal: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ orgSlug: "test-org" }),
}));

const { CurrentPlanCard } = await import("./current-plan-card");

describe("CurrentPlanCard (free tier)", () => {
	it("shows the tier label", () => {
		render(<CurrentPlanCard />);
		expect(screen.getByText(/hobby/i)).toBeDefined();
	});

	it("hides Manage subscription button when on free tier", () => {
		render(<CurrentPlanCard />);
		expect(
			screen.queryByRole("button", { name: /manage subscription/i }),
		).toBeNull();
	});
});
