import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SubscriptionTier } from "@orbit/shared";
import { TIER_METADATA } from "@orbit/shared";
import { count, eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";

@Injectable()
export class BillingService {
	constructor(
		@Inject(DB) private readonly db: Db,
		private readonly config: ConfigService,
	) {}

	async getOrgBySlug(slug: string) {
		return this.db.query.organization.findFirst({
			where: eq(schema.organization.slug, slug),
		});
	}

	async getBillingRecord(organizationId: string) {
		return this.db.query.organizationBilling.findFirst({
			where: eq(schema.organizationBilling.organizationId, organizationId),
		});
	}

	async getOrCreateBillingRecord(
		organizationId: string,
		stripeCustomerId: string,
	) {
		const existing = await this.getBillingRecord(organizationId);
		if (existing) return existing;

		const record = {
			id: randomUUID(),
			organizationId,
			stripeCustomerId,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		await this.db.insert(schema.organizationBilling).values(record);
		return record;
	}

	async getSubscription(organizationId: string) {
		return this.db.query.subscription.findFirst({
			where: eq(schema.subscription.organizationId, organizationId),
		});
	}

	async getOrgSubscriptionTier(organizationId: string): Promise<SubscriptionTier> {
		const sub = await this.getSubscription(organizationId);
		if (!sub || sub.status === "canceled" || sub.status === "unpaid") {
			return "free";
		}
		return sub.subscriptionTier as SubscriptionTier;
	}

	async getOrgSubscriptionBySlug(slug: string): Promise<SubscriptionTier> {
		const org = await this.getOrgBySlug(slug);
		if (!org) return "free";
		return this.getOrgSubscriptionTier(org.id);
	}

	async getMemberCount(organizationId: string): Promise<number> {
		const result = await this.db
			.select({ value: count() })
			.from(schema.member)
			.where(eq(schema.member.organizationId, organizationId));
		return result[0]?.value ?? 0;
	}

	async canAddMember(organizationId: string): Promise<boolean> {
		const tier = await this.getOrgSubscriptionTier(organizationId);
		const metadata = TIER_METADATA[tier];
		if (metadata.memberLimit === -1) return true;
		const memberCount = await this.getMemberCount(organizationId);
		return memberCount < metadata.memberLimit;
	}

	async upsertSubscription(data: {
		organizationId: string;
		stripeSubscriptionId: string;
		stripePriceId: string;
		subscriptionTier: SubscriptionTier;
		status: string;
		currentPeriodStart: Date;
		currentPeriodEnd: Date;
		cancelAtPeriodEnd: boolean;
	}) {
		const existing = await this.getSubscription(data.organizationId);
		const now = new Date();

		if (existing) {
			await this.db
				.update(schema.subscription)
				.set({
					stripeSubscriptionId: data.stripeSubscriptionId,
					stripePriceId: data.stripePriceId,
					subscriptionTier: data.subscriptionTier,
					status: data.status,
					currentPeriodStart: data.currentPeriodStart,
					currentPeriodEnd: data.currentPeriodEnd,
					cancelAtPeriodEnd: data.cancelAtPeriodEnd,
					updatedAt: now,
				})
				.where(eq(schema.subscription.organizationId, data.organizationId));
		} else {
			await this.db.insert(schema.subscription).values({
				id: randomUUID(),
				...data,
				createdAt: now,
				updatedAt: now,
			});
		}
	}

	async findBillingByCustomerId(stripeCustomerId: string) {
		return this.db.query.organizationBilling.findFirst({
			where: eq(schema.organizationBilling.stripeCustomerId, stripeCustomerId),
		});
	}

	async deleteSubscription(stripeSubscriptionId: string) {
		await this.db
			.delete(schema.subscription)
			.where(
				eq(schema.subscription.stripeSubscriptionId, stripeSubscriptionId),
			);
	}

	mapPriceIdToTier(priceId: string): SubscriptionTier {
		const proPriceId = this.config.get<string>("STRIPE_PRO_PRICE_ID");
		const enterprisePriceId = this.config.get<string>(
			"STRIPE_ENTERPRISE_PRICE_ID",
		);

		if (priceId === proPriceId) return "pro";
		if (priceId === enterprisePriceId) return "enterprise";
		return "free";
	}

	getPriceIdForTier(tier: SubscriptionTier): string | null {
		if (tier === "pro") {
			return this.config.getOrThrow<string>("STRIPE_PRO_PRICE_ID");
		}
		if (tier === "enterprise") {
			return this.config.getOrThrow<string>("STRIPE_ENTERPRISE_PRICE_ID");
		}
		return null;
	}
}
