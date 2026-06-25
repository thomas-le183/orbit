jest.mock("../common/guards/auth.guard", () => ({
	AuthGuard: class {},
}));

import { BillingController } from "./billing.controller";

describe("BillingController", () => {
	function createController({
		plan,
		subscription = null,
		billingInterval = null,
		pricePerSeat = null,
	}: {
		plan: "free" | "basic" | "business" | "enterprise";
		subscription?: Record<string, unknown> | null;
		billingInterval?: "monthly" | "yearly" | null;
		pricePerSeat?: number | null;
	}) {
		const billingService = {
			getOrgMember: jest.fn().mockResolvedValue({ id: "member_123" }),
			getOrgSubscriptionPlan: jest.fn().mockResolvedValue(plan),
			getSubscription: jest.fn().mockResolvedValue(subscription),
			getMemberCount: jest.fn().mockResolvedValue(3),
getSubscriptionBillingInterval: jest
				.fn()
				.mockResolvedValue(billingInterval),
			getPricePerSeat: jest.fn().mockResolvedValue(pricePerSeat),
		};
		const db = {
			query: {
				organization: {
					findFirst: jest.fn().mockResolvedValue({
						id: "org_123",
						slug: "acme",
					}),
				},
			},
		};

		return {
			controller: new BillingController(billingService as never, db as never),
			billingService,
		};
	}

	it("returns null seat billing values for free plans even with an old subscription row", async () => {
		const { controller, billingService } = createController({
			plan: "free",
			subscription: {
				status: "canceled",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-02-01"),
				cancelAtPeriodEnd: false,
				billingInterval: "monthly",
			},
		});

		const response = await controller.getSubscription("acme", {
			id: "user_123",
		} as never);

		expect(response.pricePerSeat).toBeNull();
		expect(response.billingInterval).toBeNull();
		expect(
			billingService.getSubscriptionBillingInterval,
		).not.toHaveBeenCalled();
		expect(billingService.getPricePerSeat).not.toHaveBeenCalled();
	});

	it("returns paid plan seat price and billing interval", async () => {
		const { controller, billingService } = createController({
			plan: "basic",
			subscription: {
				status: "active",
				periodStart: new Date("2026-01-01"),
				periodEnd: new Date("2026-02-01"),
				cancelAtPeriodEnd: false,
			},
			billingInterval: "monthly",
			pricePerSeat: 10,
		});

		const response = await controller.getSubscription("acme", {
			id: "user_123",
		} as never);

		expect(response.pricePerSeat).toBe(10);
		expect(response.billingInterval).toBe("monthly");
		expect(billingService.getSubscriptionBillingInterval).toHaveBeenCalled();
		expect(billingService.getPricePerSeat).toHaveBeenCalledWith(
			"basic",
			"monthly",
		);
	});
});
