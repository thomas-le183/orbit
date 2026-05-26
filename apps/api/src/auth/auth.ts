import { stripe } from "@better-auth/stripe";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import Stripe from "stripe";
import * as schema from "../db/schema";

const db = drizzle(process.env.DATABASE_URL!, { schema });
// biome-ignore lint/suspicious/noExplicitAny: stripe CJS/ESM type mismatch
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!) as any;

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: process.env.BETTER_AUTH_URL!,
	trustedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "").split(","),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	advanced: {
		cookiePrefix: "orbit",
		database: { generateId: "uuid" },
	},
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		requireEmailVerification: true,
	},
	emailVerification: { autoSignInAfterVerification: true },
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			mapProfileToUser: (profile) => ({
				name: profile.name,
				image: profile.picture,
			}),
		},
	},
	experimental: { joins: true },
	databaseHooks: {},
	hooks: {},
	user: {
		deleteUser: { enabled: true },
		changeEmail: { enabled: true },
	},
	session: {},
	account: { encryptOAuthTokens: true },
	plugins: [
		stripe({
			stripeClient,
			stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
			organization: { enabled: true },
			subscription: {
				enabled: true,
				requireEmailVerification: true,
				plans: [
					{
						name: "basic",
						lookupKey: "basic_monthly",
						annualDiscountLookupKey: "basic_yearly",
					},
					{
						name: "business",
						lookupKey: "business_monthly",
						annualDiscountLookupKey: "business_yearly",
					},
				],
				getCheckoutSessionParams: async () => {
					return { params: {} };
				},
			},
		}),
		organization({
			allowUserToCreateOrganization: true,
			teams: { enabled: true, defaultTeam: { enabled: false } },
			requireEmailVerificationOnInvitation: true,
		}),
	],
});
