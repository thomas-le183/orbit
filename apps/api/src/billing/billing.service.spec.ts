import { BillingService } from "./billing.service";

describe("BillingService", () => {
	function createService() {
		const service = new BillingService(
			{} as never,
			{
				getOrThrow: jest.fn().mockReturnValue("sk_test_123"),
			} as never,
		);
		const stripe = {
			prices: {
				list: jest.fn(),
			},
			subscriptions: {
				retrieve: jest.fn(),
			},
		};
		(service as unknown as { stripe: typeof stripe }).stripe = stripe;
		return { service, stripe };
	}

	it("gets monthly per-seat price from Stripe lookup keys", async () => {
		const { service, stripe } = createService();
		stripe.prices.list.mockResolvedValue({
			data: [{ id: "price_basic_monthly", unit_amount: 1000 }],
		});

		await expect(service.getPricePerSeat("basic", "monthly")).resolves.toBe(10);
		expect(stripe.prices.list).toHaveBeenCalledWith({
			lookup_keys: ["basic_monthly"],
			limit: 1,
		});
	});

	it("gets yearly per-seat price from Stripe lookup keys", async () => {
		const { service, stripe } = createService();
		stripe.prices.list.mockResolvedValue({
			data: [{ id: "price_business_yearly", unit_amount: 18000 }],
		});

		await expect(service.getPricePerSeat("business", "yearly")).resolves.toBe(
			180,
		);
		expect(stripe.prices.list).toHaveBeenCalledWith({
			lookup_keys: ["business_yearly"],
			limit: 1,
		});
	});

	it("returns null when a plan has no Stripe per-seat lookup key", async () => {
		const { service, stripe } = createService();

		await expect(service.getPricePerSeat("free", null)).resolves.toBeNull();
		await expect(
			service.getPricePerSeat("enterprise", "monthly"),
		).resolves.toBeNull();
		expect(stripe.prices.list).not.toHaveBeenCalled();
	});
});
