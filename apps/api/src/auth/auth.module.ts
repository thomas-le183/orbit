import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { DB, type Db } from "../db/db.module";
import { EmailModule } from "../email/email.module";
import { EmailService } from "../email/email.service";
import * as schema from "../db/schema";
import { AUTH } from "./auth.constants";
import { AuthController } from "./auth.controller";

@Module({
	imports: [EmailModule],
	providers: [
		{
			provide: AUTH,
			useFactory: (db: Db, config: ConfigService, email: EmailService) => {
				const appUrl = config.get<string>("APP_URL") ?? "http://localhost:5173";

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
					},

					emailVerification: {
						sendVerificationEmail: async ({ user, url }) => {
							void email.sendVerifyEmail(user.email, user.name, url);
						},
						afterEmailVerification: async (user) => {
							void email.sendWelcome(user.email, user.name);
						},
					},

					emailAndPassword: {
						enabled: true,
						requireEmailVerification: true,
						sendResetPassword: async ({ user, url }) => {
							void email.sendResetPassword(user.email, user.name, url);
						},
					},

					user: {
						deleteUser: { enabled: true },
					},

					plugins: [
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

							organizationHooks: {
								afterCreateOrganization: async ({ organization: org, user: owner }) => {
									void email.sendWorkspaceCreated(owner.email, {
										ownerName: owner.name,
										organizationName: org.name,
										workspaceUrl: `${appUrl}/${org.slug}`,
									});
								},

								afterAcceptInvitation: async ({ invitation, user: newMember, organization: org }) => {
									const inviter = await db.query.user.findFirst({
										where: eq(schema.user.id, invitation.inviterId),
									});
									if (inviter) {
										void email.sendMemberJoined(inviter.email, {
											newMemberName: newMember.name,
											newMemberEmail: newMember.email,
											organizationName: org.name,
											workspaceUrl: `${appUrl}/${org.slug}`,
										});
									}
								},

								beforeCreateInvitation: async () => {},
								afterCreateInvitation: async () => {},
								beforeCancelInvitation: async () => {},
								afterCancelInvitation: async () => {},
								beforeRejectInvitation: async () => {},
								afterRejectInvitation: async () => {},
								beforeCreateOrganization: async () => {},
								beforeUpdateOrganization: async () => {},
								afterUpdateOrganization: async () => {},
								beforeDeleteOrganization: async () => {},
								afterDeleteOrganization: async () => {},
								beforeCreateTeam: async () => {},
								afterCreateTeam: async () => {},
								beforeUpdateTeam: async () => {},
								afterUpdateTeam: async () => {},
								beforeDeleteTeam: async () => {},
								afterDeleteTeam: async () => {},
								beforeAddMember: async () => {},
								afterAddMember: async () => {},
								beforeUpdateMemberRole: async () => {},
								afterUpdateMemberRole: async () => {},
								beforeRemoveMember: async () => {},
								afterRemoveMember: async () => {},
								beforeAddTeamMember: async () => {},
								afterAddTeamMember: async () => {},
								beforeRemoveTeamMember: async () => {},
								afterRemoveTeamMember: async () => {},
								beforeAcceptInvitation: async () => {},
							},
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
