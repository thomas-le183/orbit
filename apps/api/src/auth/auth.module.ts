import { stripe } from "@better-auth/stripe";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { EmailModule } from "../email/email.module";
import { EmailService } from "../email/email.service";
import { AUTH } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { createOrganizationHooks } from "./organization-billing-hooks";

@Module({
	imports: [EmailModule],
	providers: [
		{
			provide: AUTH,
			useFactory: (db: Db, config: ConfigService, email: EmailService) => {
				const appUrl = config.get<string>("WEB_BASE_URL")!;

				const stripeKey = config.getOrThrow<string>("STRIPE_SECRET_KEY");
				const stripeClient = new Stripe(stripeKey);
				// biome-ignore lint/suspicious/noExplicitAny: stripe CJS/ESM type mismatch
				const betterAuthStripeClient = stripeClient as any;

				return betterAuth({
					secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
					baseURL: config.getOrThrow<string>("BETTER_AUTH_URL"),
					trustedOrigins: config
						.getOrThrow<string>("CORS_ALLOWED_ORIGINS")
						.split(","),
					database: drizzleAdapter(db, {
						provider: "pg",
						schema,
					}),
					advanced: {
						cookiePrefix: "orbit",
						database: { generateId: "uuid" },
					},

					socialProviders: {
						google: {
							clientId: config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
							clientSecret: config.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
							mapProfileToUser: (profile) => ({
								name: profile.name,
								image: profile.picture,
							}),
						},
					},

					experimental: { joins: true },

					emailVerification: {
						autoSignInAfterVerification: true,
						sendVerificationEmail: async ({ user, url }) => {
							void email.sendVerifyEmail(user.email, user.name, url);
						},
						afterEmailVerification: async (user) => {
							void email.sendWelcome(user.email, user.name);
						},
					},

					emailAndPassword: {
						enabled: true,
						autoSignIn: true,
						requireEmailVerification: true,
						sendResetPassword: async ({ user, url }) => {
							void email.sendResetPassword(user.email, user.name, url);
						},
					},

					user: {
						deleteUser: {
							enabled: true,
							sendDeleteAccountVerification: async ({ user, url }) => {
								void email.sendDeleteAccount(user.email, user.name, url);
							},
						},
						changeEmail: {
							enabled: true,
							sendChangeEmailVerification: async ({ user, newEmail, url }) => {
								void email.sendChangeEmail(
									user.email,
									user.name,
									newEmail,
									url,
								);
							},
						},
					},

					session: {},
					account: { encryptOAuthTokens: true },
					databaseHooks: {},
					hooks: {},

					plugins: [
						stripe({
							stripeClient: betterAuthStripeClient,
							stripeWebhookSecret: config.getOrThrow<string>(
								"STRIPE_WEBHOOK_SECRET",
							),
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
										freeTrial: { days: 7 },
									},
								],
								authorizeReference: async ({ user, referenceId, action }) => {
									const member = await db.query.member.findFirst({
										where: and(
											eq(schema.member.userId, user.id),
											eq(schema.member.organizationId, referenceId),
										),
									});
									if (!member) return false;
									if (action === "list-subscription") return true;
									return member.role === "owner" || member.role === "admin";
								},
								getCheckoutSessionParams: async () => {
									return {
										params: {},
									};
								},
							},
						}),
						organization({
							allowUserToCreateOrganization: true,
							teams: {
								enabled: true,
								defaultTeam: { enabled: false },
							},

							sendInvitationEmail: async (data) => {
								void email.sendInvitation(data.email, {
									inviterName: data.inviter.user.name,
									organizationName: data.organization.name,
									inviteUrl: `${appUrl}/invite/${data.id}`,
								});
							},

							organizationHooks: createOrganizationHooks({
								db,
								email,
								appUrl,
								stripeClient,
							}),
						}),
					],
				});
			},
			inject: [DB, ConfigService, EmailService],
		},
	],
	controllers: [AuthController],
	exports: [AUTH],
})
export class AuthModule {}
