import {
	createOrganizationHooks,
	syncStripeSeatQuantity,
} from "./organization-billing-hooks";

function createDbMock(subscription: Record<string, unknown> | null) {
	const memberWhere = jest.fn().mockResolvedValue([{ value: 3 }]);
	const memberFrom = jest.fn().mockReturnValue({ where: memberWhere });
	const select = jest.fn().mockReturnValue({ from: memberFrom });

	return {
		query: {
			subscription: {
				findFirst: jest.fn().mockResolvedValue(subscription),
			},
			user: {
				findFirst: jest.fn().mockResolvedValue({
					email: "owner@example.com",
				}),
			},
		},
		select,
	};
}

function createStripeMock() {
	return {
		prices: {
			list: jest.fn().mockResolvedValue({
				data: [
					{
						id: "price_basic_monthly",
						lookup_key: "basic_monthly",
						unit_amount: 1000,
					},
				],
			}),
		},
		subscriptions: {
			retrieve: jest.fn().mockResolvedValue({
				id: "sub_123",
				items: {
					data: [
						{
							id: "wrong_item",
							quantity: 1,
							price: {
								id: "price_wrong",
								lookup_key: "wrong_lookup",
								recurring: { interval: "month" },
							},
						},
						{
							id: "seat_item",
							quantity: 1,
							price: {
								id: "price_basic_monthly",
								lookup_key: "basic_monthly",
								recurring: { interval: "month" },
							},
						},
					],
				},
			}),
			update: jest.fn().mockResolvedValue({ id: "sub_123" }),
		},
	};
}

describe("per-seat billing organization hooks", () => {
	it("preserves joined-member email and syncs accepted invites with immediate invoicing", async () => {
		const db = createDbMock({
			plan: "basic",
			referenceId: "org_123",
			stripeSubscriptionId: "sub_123",
			billingInterval: "monthly",
		});
		const stripe = createStripeMock();
		const emailQueue = { add: jest.fn() };
		const hooks = createOrganizationHooks({
			db: db as never,
			emailQueue: emailQueue as never,
			appUrl: "https://app.example.com",
			stripeClient: stripe as never,
		});

		await hooks.afterAcceptInvitation({
			invitation: { inviterId: "user_owner" },
			user: { name: "New Member", email: "new@example.com" },
			organization: { id: "org_123", name: "Acme", slug: "acme" },
		});

		expect(emailQueue.add).toHaveBeenCalledWith("send-member-joined", {
			type: "send-member-joined",
			to: "owner@example.com",
			data: {
				newMemberName: "New Member",
				newMemberEmail: "new@example.com",
				organizationName: "Acme",
				workspaceUrl: "https://app.example.com/acme",
			},
		});
		expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
			items: [{ id: "seat_item", quantity: 3 }],
			proration_behavior: "always_invoice",
		});
	});

	it("syncs removed members with next-invoice prorations", async () => {
		const db = createDbMock({
			plan: "basic",
			referenceId: "org_123",
			stripeSubscriptionId: "sub_123",
			billingInterval: "monthly",
		});
		const stripe = createStripeMock();
		const hooks = createOrganizationHooks({
			db: db as never,
			emailQueue: { add: jest.fn() } as never,
			appUrl: "https://app.example.com",
			stripeClient: stripe as never,
		});

		await hooks.afterRemoveMember({
			organization: { id: "org_123" },
		});

		expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
			items: [{ id: "seat_item", quantity: 3 }],
			proration_behavior: "create_prorations",
		});
	});

	it("does not sync seats for free plans", async () => {
		const db = createDbMock({
			plan: "free",
			referenceId: "org_123",
			stripeSubscriptionId: "sub_123",
			billingInterval: null,
		});
		const stripe = createStripeMock();

		await syncStripeSeatQuantity({
			db: db as never,
			stripeClient: stripe as never,
			organizationId: "org_123",
			prorationBehavior: "always_invoice",
		});

		expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
		expect(stripe.subscriptions.update).not.toHaveBeenCalled();
	});

	it("does not sync seats when no subscription exists", async () => {
		const db = createDbMock(null);
		const stripe = createStripeMock();

		await syncStripeSeatQuantity({
			db: db as never,
			stripeClient: stripe as never,
			organizationId: "org_123",
			prorationBehavior: "always_invoice",
		});

		expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
		expect(stripe.subscriptions.update).not.toHaveBeenCalled();
	});
});
