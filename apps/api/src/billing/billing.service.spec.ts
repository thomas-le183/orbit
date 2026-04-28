import { BadRequestException } from "@nestjs/common";
import { BillingService } from "./billing.service";

const mockDb = {
  query: {
    organizationBilling: { findFirst: jest.fn() },
    subscription: { findFirst: jest.fn() },
  },
  insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  }),
};

const mockStripe = {
  createCustomer: jest.fn(),
  createTrialSubscription: jest.fn(),
};

function makeService() {
  const svc = new BillingService(mockDb as any, mockStripe as any);
  return svc;
}

beforeEach(() => jest.clearAllMocks());

describe("isTrialEligible", () => {
  it("returns true when no billing record exists", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue(null);
    const svc = makeService();
    expect(await svc.isTrialEligible("org-1")).toBe(true);
  });

  it("returns true when trialUsedAt is null", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue({
      trialUsedAt: null,
    });
    const svc = makeService();
    expect(await svc.isTrialEligible("org-1")).toBe(true);
  });

  it("returns false when trialUsedAt is set", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue({
      trialUsedAt: new Date(),
    });
    const svc = makeService();
    expect(await svc.isTrialEligible("org-1")).toBe(false);
  });
});

describe("startTrial", () => {
  it("throws BadRequestException when trial already used", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue({
      trialUsedAt: new Date(),
      stripeCustomerId: "cus_123",
      organizationId: "org-1",
      id: "b1",
    });
    const svc = makeService();
    await expect(svc.startTrial("org-1", "Acme", "user@test.com")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when active subscription exists", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue({
      trialUsedAt: null,
      stripeCustomerId: "cus_123",
      organizationId: "org-1",
      id: "b1",
    });
    mockDb.query.subscription.findFirst.mockResolvedValue({ status: "active" });
    const svc = makeService();
    await expect(svc.startTrial("org-1", "Acme", "user@test.com")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates trial subscription and marks trial used when eligible", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue({
      trialUsedAt: null,
      stripeCustomerId: "cus_123",
      organizationId: "org-1",
      id: "b1",
    });
    mockDb.query.subscription.findFirst.mockResolvedValue(null);
    mockStripe.createTrialSubscription.mockResolvedValue({
      id: "sub_trial",
      status: "trialing",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: { id: "price_biz" },
            current_period_start: 1700000000,
            current_period_end: 1700604800,
          },
        ],
      },
    });

    const svc = makeService();
    await svc.startTrial("org-1", "Acme", "user@test.com");

    expect(mockStripe.createTrialSubscription).toHaveBeenCalledWith(
      "cus_123",
      expect.any(String), // lookup key
      "org-1",
    );
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("creates a new Stripe customer when no billing record exists", async () => {
    mockDb.query.organizationBilling.findFirst.mockResolvedValue(null);
    mockDb.query.subscription.findFirst.mockResolvedValue(null);
    mockStripe.createCustomer.mockResolvedValue({ id: "cus_new" });
    mockStripe.createTrialSubscription.mockResolvedValue({
      id: "sub_trial",
      status: "trialing",
      cancel_at_period_end: false,
      items: {
        data: [
          {
            price: { id: "price_biz" },
            current_period_start: 1700000000,
            current_period_end: 1700604800,
          },
        ],
      },
    });

    const svc = makeService();
    await svc.startTrial("org-1", "Acme", "user@test.com");

    expect(mockStripe.createCustomer).toHaveBeenCalledWith(
      "org-1",
      "Acme",
      "user@test.com",
    );
    expect(mockStripe.createTrialSubscription).toHaveBeenCalledWith(
      "cus_new",
      expect.any(String),
      "org-1",
    );
  });
});

describe("upsertSubscription", () => {
  it("calls markTrialUsed when status is trialing", async () => {
    mockDb.query.subscription.findFirst.mockResolvedValue(null);
    mockDb.query.organizationBilling.findFirst.mockResolvedValue({
      trialUsedAt: null,
      organizationId: "org-1",
    });

    const svc = makeService();
    const markSpy = jest.spyOn(svc, "markTrialUsed").mockResolvedValue();

    await svc.upsertSubscription({
      organizationId: "org-1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_1",
      subscriptionPlan: "business",
      status: "trialing",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    });

    expect(markSpy).toHaveBeenCalledWith("org-1");
  });

  it("does not call markTrialUsed when status is active", async () => {
    mockDb.query.subscription.findFirst.mockResolvedValue(null);

    const svc = makeService();
    const markSpy = jest.spyOn(svc, "markTrialUsed").mockResolvedValue();

    await svc.upsertSubscription({
      organizationId: "org-1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_1",
      subscriptionPlan: "business",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    });

    expect(markSpy).not.toHaveBeenCalled();
  });
});
