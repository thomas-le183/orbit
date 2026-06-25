import { describe, expect, it } from "vitest";
import { buildPricingPlans } from "./pricing-table";

function ctaFor(plan: string, plans: ReturnType<typeof buildPricingPlans>) {
	return plans.find((p) => p.id === plan)?.cta;
}
function disabledFor(plan: string, plans: ReturnType<typeof buildPricingPlans>) {
	return plans.find((p) => p.id === plan)?.ctaDisabled;
}
function onCtaFor(plan: string, plans: ReturnType<typeof buildPricingPlans>) {
	return plans.find((p) => p.id === plan)?.onCta;
}

// ─── Fresh user (free plan, no subscription) ────────────────────────────────

describe("free plan — no subscription history", () => {
	const plans = buildPricingPlans("free", false, false);

	it("marks Hobby as current plan", () => {
		expect(ctaFor("free", plans)).toBe("Current plan");
		expect(disabledFor("free", plans)).toBe(true);
	});

	it("shows Get started for Basic", () => {
		expect(ctaFor("basic", plans)).toBe("Get started");
		expect(disabledFor("basic", plans)).toBe(false);
	});

	it("shows Get started for Business", () => {
		expect(ctaFor("business", plans)).toBe("Get started");
	});

	it("shows Contact Sales for Enterprise", () => {
		expect(ctaFor("enterprise", plans)).toBe("Contact Sales");
	});

	it("Hobby has no onCta (always disabled)", () => {
		expect(onCtaFor("free", plans)).toBeUndefined();
	});
});

// ─── Active Basic subscriber ─────────────────────────────────────────────────

describe("active Basic subscription", () => {
	const plans = buildPricingPlans("basic", true, false);

	it("marks Basic as current plan", () => {
		expect(ctaFor("basic", plans)).toBe("Current plan");
		expect(disabledFor("basic", plans)).toBe(true);
	});

	it("shows Upgrade for Business", () => {
		expect(ctaFor("business", plans)).toBe("Upgrade");
		expect(disabledFor("business", plans)).toBe(false);
	});

	it("shows Downgrade to free (disabled) for Hobby", () => {
		expect(ctaFor("free", plans)).toBe("Downgrade to free");
		expect(disabledFor("free", plans)).toBe(true);
	});

	it("shows Contact Sales for Enterprise", () => {
		expect(ctaFor("enterprise", plans)).toBe("Contact Sales");
	});
});

// ─── Active Business subscriber ──────────────────────────────────────────────

describe("active Business subscription", () => {
	const plans = buildPricingPlans("business", true, false);

	it("marks Business as current plan", () => {
		expect(ctaFor("business", plans)).toBe("Current plan");
	});

	it("shows Downgrade for Basic", () => {
		expect(ctaFor("basic", plans)).toBe("Downgrade");
		expect(disabledFor("basic", plans)).toBe(false);
	});

	it("shows Downgrade to free (disabled) for Hobby", () => {
		expect(ctaFor("free", plans)).toBe("Downgrade to free");
		expect(disabledFor("free", plans)).toBe(true);
	});
});

// ─── Trialing (Business trial, treated as active sub) ────────────────────────

describe("trialing Business — hasActiveSubscription=true", () => {
	const plans = buildPricingPlans("business", true, false);

	it("marks Business as current plan", () => {
		expect(ctaFor("business", plans)).toBe("Current plan");
	});

	it("shows Downgrade for Basic instead of Get started", () => {
		expect(ctaFor("basic", plans)).toBe("Downgrade");
	});
});

// ─── Past due (plan reverted to free by backend) ─────────────────────────────

describe("past_due — plan shown as free, subscription still active", () => {
	const plans = buildPricingPlans("free", true, false);

	it("marks Hobby as current plan", () => {
		expect(ctaFor("free", plans)).toBe("Current plan");
	});

	it("shows Upgrade for Basic and Business", () => {
		expect(ctaFor("basic", plans)).toBe("Upgrade");
		expect(ctaFor("business", plans)).toBe("Upgrade");
	});
});

// ─── isPending disables all non-current, non-free buttons ────────────────────

describe("isPending=true", () => {
	const plans = buildPricingPlans("basic", true, true);

	it("disables Business while pending", () => {
		expect(disabledFor("business", plans)).toBe(true);
		expect(onCtaFor("business", plans)).toBeUndefined();
	});

	it("Basic still shows Current plan", () => {
		expect(ctaFor("basic", plans)).toBe("Current plan");
	});
});

// ─── onCta wiring ─────────────────────────────────────────────────────────────

describe("onCta callback", () => {
	it("fires with correct plan and interval", () => {
		const calls: [string, string][] = [];
		const plans = buildPricingPlans("basic", true, false, "business", (plan, interval) => {
			calls.push([plan, interval]);
		});
		onCtaFor("business", plans)?.("monthly");
		expect(calls).toEqual([["business", "monthly"]]);
	});

	it("is undefined for current plan", () => {
		const plans = buildPricingPlans("basic", true, false);
		expect(onCtaFor("basic", plans)).toBeUndefined();
	});

	it("is undefined for free plan (always disabled)", () => {
		const plans = buildPricingPlans("business", true, false);
		expect(onCtaFor("free", plans)).toBeUndefined();
	});
});
