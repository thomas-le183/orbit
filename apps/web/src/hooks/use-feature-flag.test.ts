import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseOrgSubscription = vi.fn();

vi.mock("@/hooks/use-billing", () => ({
	useOrgSubscription: () => mockUseOrgSubscription(),
}));

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ orgSlug: "test-org" }),
}));

// Import AFTER mocks
const { useFeatureFlag } = await import("./use-feature-flag");

describe("useFeatureFlag", () => {
	beforeEach(() => mockUseOrgSubscription.mockClear());

	it("returns enabled:true while loading (fail-open)", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
		expect(result.current.enabled).toBe(true);
	});

	it("returns enabled:true on error (fail-open)", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
		});
		const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
		expect(result.current.enabled).toBe(true);
	});

	it("returns enabled:false for hasAdvancedAnalytics on free tier", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: {
				tier: "free",
				usage: { members: { current: 1, limit: 5 } },
				subscription: null,
			},
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
		expect(result.current.enabled).toBe(false);
		expect(result.current.requiredTier).toBe("team");
	});

	it("returns enabled:true for hasAdvancedAnalytics on team tier", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: {
				tier: "team",
				usage: { members: { current: 3, limit: 25 } },
				subscription: null,
			},
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
		expect(result.current.enabled).toBe(true);
	});

	it("returns requiredTier:enterprise for hasSSO on pro tier", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: {
				tier: "pro",
				usage: { members: { current: 10, limit: 100 } },
				subscription: null,
			},
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasSSO"));
		expect(result.current.enabled).toBe(false);
		expect(result.current.requiredTier).toBe("enterprise");
	});
});
