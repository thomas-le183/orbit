import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-feature-flag", () => ({
	useFeatureFlag: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("@/hooks/use-billing", () => ({
	useOrgSubscription: () => ({ data: { tier: "free" }, isLoading: false }),
	useCheckout: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Import AFTER mocks
import { useFeatureFlag } from "@/hooks/use-feature-flag";

const { UpgradeGate } = await import("./upgrade-gate");

describe("UpgradeGate", () => {
	it("renders children normally when feature is enabled", () => {
		vi.mocked(useFeatureFlag).mockReturnValue({
			enabled: true,
			requiredTier: "team",
		});
		render(
			<UpgradeGate flag="hasAdvancedAnalytics">
				<button>Analytics</button>
			</UpgradeGate>,
		);
		const btn = screen.getByRole("button", { name: "Analytics" });
		expect(btn).toBeDefined();
		expect(btn.closest("[data-upgrade-gate]")).toBeNull();
	});

	it("renders children as disabled when feature is not enabled", () => {
		vi.mocked(useFeatureFlag).mockReturnValue({
			enabled: false,
			requiredTier: "pro",
		});
		render(
			<UpgradeGate flag="hasCustomBranding">
				<button>Branding</button>
			</UpgradeGate>,
		);
		const gate = document.querySelector("[data-upgrade-gate]");
		expect(gate).toBeDefined();
		expect(gate?.className).toMatch(/opacity-50/);
	});

	it("opens upgrade modal on click when feature is not enabled", () => {
		vi.mocked(useFeatureFlag).mockReturnValue({
			enabled: false,
			requiredTier: "pro",
		});
		render(
			<UpgradeGate flag="hasCustomBranding">
				<button>Branding</button>
			</UpgradeGate>,
		);
		const gate = document.querySelector("[data-upgrade-gate]") as HTMLElement;
		fireEvent.click(gate);
		expect(screen.getByText(/upgrade your plan/i)).toBeDefined();
	});
});
