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
    const r = deriveShowActions({ ...base, subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(r.showUpgrade).toBe(true);
    expect(r.nextTier).toBe("basic");
  });

  it("shows upgrade on active basic plan", () => {
    const r = deriveShowActions({ ...base, subStatus: "active", currentPlan: "basic", billingInterval: "monthly", trialEligible: false });
    expect(r.showUpgrade).toBe(true);
    expect(r.nextTier).toBe("business");
  });

  it("does not show upgrade on business plan", () => {
    const r = deriveShowActions({ ...base, subStatus: "active", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showUpgrade).toBe(false);
  });

  it("shows switch-to-yearly when active and monthly", () => {
    const r = deriveShowActions({ ...base, subStatus: "active", currentPlan: "basic", billingInterval: "monthly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(true);
  });

  it("does not show switch-to-yearly when already yearly", () => {
    const r = deriveShowActions({ ...base, subStatus: "active", currentPlan: "basic", billingInterval: "yearly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(false);
  });

  it("shows trial CTA only when no sub and trialEligible", () => {
    const yes = deriveShowActions({ ...base, subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: true });
    const no = deriveShowActions({ ...base, subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false });
    expect(yes.showTrialCta).toBe(true);
    expect(no.showTrialCta).toBe(false);
  });

  it("shows subscribe-now when trialing, not upgrade", () => {
    const r = deriveShowActions({ ...base, subStatus: "trialing", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showSubscribeNow).toBe(true);
    expect(r.showUpgrade).toBe(false);
  });

  it("shows switch-to-yearly when trialing and monthly", () => {
    const r = deriveShowActions({ ...base, subStatus: "trialing", currentPlan: "business", billingInterval: "monthly", trialEligible: false });
    expect(r.showSwitchYearly).toBe(true);
    expect(r.showSubscribeNow).toBe(true);
  });

  it("shows convertTrial when trial ended and plan reverted to free", () => {
    const r = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false, rawSub: { plan: "business", wasTrial: true } });
    expect(r.showConvertTrial).toBe(true);
    expect(r.showUpgrade).toBe(false);
    expect(r.showTrialCta).toBe(false);
  });

  it("shows resubscribe when paid sub ended and plan reverted to free", () => {
    const r = deriveShowActions({ subStatus: null, currentPlan: "free", billingInterval: null, trialEligible: false, rawSub: { plan: "business", wasTrial: false } });
    expect(r.showResubscribe).toBe(true);
    expect(r.showUpgrade).toBe(false);
  });
});
