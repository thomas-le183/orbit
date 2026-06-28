import { describe, expect, it } from "vitest";
import {
	deriveShowActions,
	formatCurrency,
	formatDateShort,
} from "./plan-summary-card";

describe("formatCurrency", () => {
	it("formats whole numbers without decimals", () => {
		expect(formatCurrency(15)).toBe("$15");
		expect(formatCurrency(120)).toBe("$120");
	});

	it("formats fractional amounts to 2 decimal places", () => {
		expect(formatCurrency(8.33)).toBe("$8.33");
	});
});

describe("formatDateShort", () => {
	it("returns a non-empty string for a valid date", () => {
		const result = formatDateShort("2026-06-25");
		expect(result).toMatch(/Jun/);
		expect(result).toMatch(/2026/);
	});
});

const base = { rawSub: null as null };

describe("deriveShowActions", () => {
	it("shows upgrade on free plan with no subscription", () => {
		const r = deriveShowActions({
			...base,
			subStatus: null,
			currentPlan: "free",
			billingInterval: null,
		});
		expect(r.showUpgrade).toBe(true);
		expect(r.nextTier).toBe("basic");
	});

	it("shows upgrade on active basic plan", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "active",
			currentPlan: "basic",
			billingInterval: "monthly",
		});
		expect(r.showUpgrade).toBe(true);
		expect(r.nextTier).toBe("business");
	});

	it("does not show upgrade on business plan", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "active",
			currentPlan: "business",
			billingInterval: "monthly",
		});
		expect(r.showUpgrade).toBe(false);
	});

	it("shows switch-to-yearly when active and monthly", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "active",
			currentPlan: "basic",
			billingInterval: "monthly",
		});
		expect(r.showSwitchYearly).toBe(true);
	});

	it("does not show switch-to-yearly when already yearly", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "active",
			currentPlan: "basic",
			billingInterval: "yearly",
		});
		expect(r.showSwitchYearly).toBe(false);
	});

	it("shows switch-to-yearly when trialing and monthly", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "trialing",
			currentPlan: "business",
			billingInterval: "monthly",
		});
		expect(r.showSwitchYearly).toBe(true);
	});

	it("does NOT show switch-to-yearly when past_due (payment failed)", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "past_due",
			currentPlan: "basic",
			billingInterval: "monthly",
		});
		expect(r.showSwitchYearly).toBe(false);
	});

	it("shows convertTrial when trial ended and plan reverted to free", () => {
		const r = deriveShowActions({
			subStatus: null,
			currentPlan: "free",
			billingInterval: null,
			rawSub: { plan: "business", wasTrial: true },
		});
		expect(r.showConvertTrial).toBe(true);
		expect(r.showUpgrade).toBe(false);
		expect(r.showResubscribe).toBe(false);
		expect(r.showConvertCanceled).toBe(false);
	});

	it("shows resubscribe when paid sub ended and plan reverted to free", () => {
		const r = deriveShowActions({
			subStatus: null,
			currentPlan: "free",
			billingInterval: null,
			rawSub: { plan: "business", wasTrial: false },
		});
		expect(r.showResubscribe).toBe(true);
		expect(r.showUpgrade).toBe(false);
		expect(r.showConvertTrial).toBe(false);
	});

	it("shows convertCanceled when trial was canceled mid-period (still has access)", () => {
		const r = deriveShowActions({
			subStatus: "canceled",
			currentPlan: "business",
			billingInterval: null,
			rawSub: { plan: "business", wasTrial: true },
		});
		expect(r.showConvertCanceled).toBe(true);
		expect(r.showConvertTrial).toBe(false);
		expect(r.showResubscribe).toBe(false);
		expect(r.showUpgrade).toBe(false);
	});

	it("does not show upgrade when trialing", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "trialing",
			currentPlan: "business",
			billingInterval: "monthly",
		});
		expect(r.showUpgrade).toBe(false);
	});

	it("does not show upgrade when on business (highest paid tier)", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "active",
			currentPlan: "business",
			billingInterval: "monthly",
		});
		expect(r.showUpgrade).toBe(false);
	});

	it("does not show any action for active business yearly (already optimal)", () => {
		const r = deriveShowActions({
			...base,
			subStatus: "active",
			currentPlan: "business",
			billingInterval: "yearly",
		});
		expect(r.showUpgrade).toBe(false);
		expect(r.showSwitchYearly).toBe(false);
		expect(r.showConvertTrial).toBe(false);
		expect(r.showResubscribe).toBe(false);
		expect(r.showConvertCanceled).toBe(false);
	});
});
