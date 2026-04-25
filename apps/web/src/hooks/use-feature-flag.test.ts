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

	it("returns enabled:false for hasAdvancedAnalytics on free plan", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: {
				plan: "free",
				usage: { members: { current: 1, limit: -1 } },
				subscription: null,
			},
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
		expect(result.current.enabled).toBe(false);
		expect(result.current.requiredPlan).toBe("business");
	});

	it("returns enabled:true for hasAdvancedAnalytics on business plan", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: {
				plan: "business",
				usage: { members: { current: 3, limit: -1 } },
				subscription: null,
			},
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasAdvancedAnalytics"));
		expect(result.current.enabled).toBe(true);
	});

	it("returns requiredPlan:enterprise for hasSSO on business plan", () => {
		mockUseOrgSubscription.mockReturnValue({
			data: {
				plan: "business",
				usage: { members: { current: 10, limit: -1 } },
				subscription: null,
			},
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlag("hasSSO"));
		expect(result.current.enabled).toBe(false);
		expect(result.current.requiredPlan).toBe("enterprise");
	});
});
