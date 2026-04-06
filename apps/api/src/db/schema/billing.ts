import {
	SUBSCRIPTION_TIERS,
	SubscriptionTier,
} from "@orbit/shared/types/billing";
import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";

// ---------- Billing tables ----------

export const organizationBilling = pgTable("organization_billing", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.unique()
		.references(() => organization.id, { onDelete: "cascade" }),
	stripeCustomerId: text("stripe_customer_id").notNull().unique(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscription = pgTable("subscription", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id")
		.notNull()
		.unique()
		.references(() => organization.id, { onDelete: "cascade" }),
	stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
	stripePriceId: text("stripe_price_id").notNull(),
	subscriptionTier: text("subscription_tier")
		.$type<SubscriptionTier>()
		.notNull()
		.default(SUBSCRIPTION_TIERS.FREE),
	status: text("status").notNull().default("active"),
	currentPeriodStart: timestamp("current_period_start").notNull(),
	currentPeriodEnd: timestamp("current_period_end").notNull(),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionRelations = relations(subscription, ({ one }) => ({
	organization: one(organization, {
		fields: [subscription.organizationId],
		references: [organization.id],
	}),
}));
