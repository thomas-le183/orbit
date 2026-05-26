import { autoStartTrial } from "./organization-billing-hooks";

describe("autoStartTrial", () => {
  function createDeps(overrides?: {
    existingSub?: object | null;
    orgStripeCustomerId?: string | null;
  }) {
    const existingSub = overrides?.existingSub !== undefined ? overrides.existingSub : null;
    const orgStripeCustomerId = overrides?.orgStripeCustomerId ?? null;

    const db = {
      query: {
        subscription: {
          findFirst: jest.fn().mockResolvedValue(existingSub),
        },
        organization: {
          findFirst: jest.fn().mockResolvedValue({
            id: "org_1",
            name: "Acme",
            stripeCustomerId: orgStripeCustomerId,
          }),
        },
      },
      update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
    };

    const stripe = {
      customers: {
        create: jest.fn().mockResolvedValue({ id: "cus_new" }),
      },
      subscriptions: {
        create: jest.fn().mockResolvedValue({ id: "sub_abc" }),
      },
      prices: {
        list: jest.fn().mockResolvedValue({
          data: [{ id: "price_biz_monthly", lookup_key: "business_monthly", unit_amount: 1500 }],
        }),
      },
    };

    return { db, stripe };
  }

  it("skips when a subscription already exists for the org", async () => {
    const { db, stripe } = createDeps({ existingSub: { id: "sub_existing" } });

    await autoStartTrial("org_1", db as never, stripe as never);

    expect(stripe.subscriptions.create).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates a Stripe customer when org has no stripeCustomerId", async () => {
    const { db, stripe } = createDeps({ orgStripeCustomerId: null });

    await autoStartTrial("org_1", db as never, stripe as never);

    expect(stripe.customers.create).toHaveBeenCalledWith({
      name: "Acme",
      metadata: { referenceId: "org_1", referenceType: "organization" },
    });
  });

  it("reuses existing stripeCustomerId without creating a new customer", async () => {
    const { db, stripe } = createDeps({ orgStripeCustomerId: "cus_existing" });

    await autoStartTrial("org_1", db as never, stripe as never);

    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.create.mock.calls[0][0].customer).toBe("cus_existing");
  });

  it("creates a trialing Stripe subscription with 14-day trial_end", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { db, stripe } = createDeps();

    await autoStartTrial("org_1", db as never, stripe as never);

    const call = stripe.subscriptions.create.mock.calls[0][0];
    expect(call.items).toEqual([{ price: "price_biz_monthly", quantity: 1 }]);
    expect(call.trial_end).toBeGreaterThanOrEqual(before + 14 * 24 * 60 * 60);
    expect(call.payment_settings.payment_method_collection).toBe("if_required");
    expect(call.metadata.referenceId).toBe("org_1");
  });

  it("inserts a subscription row with status trialing and plan business", async () => {
    const { db, stripe } = createDeps();

    await autoStartTrial("org_1", db as never, stripe as never);

    expect(db.insert).toHaveBeenCalled();
    const values = db.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(values.plan).toBe("business");
    expect(values.status).toBe("trialing");
    expect(values.referenceId).toBe("org_1");
    expect(values.stripeSubscriptionId).toBe("sub_abc");
    expect(values.seats).toBe(1);
    expect(values.billingInterval).toBe("monthly");
  });
});
