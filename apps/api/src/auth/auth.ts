import path from "node:path";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import * as dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Resend } from "resend";
import * as schema from "../db/schema";
import { invitationEmail } from "../email/templates/invitation";
import { memberJoinedEmail } from "../email/templates/member-joined";
import { resetPasswordEmail } from "../email/templates/reset-password";
import { verifyEmailTemplate } from "../email/templates/verify-email";
import { welcomeEmail } from "../email/templates/welcome";
import { workspaceCreatedEmail } from "../email/templates/workspace-created";

expand(dotenv.config({ path: path.resolve(__dirname, "../../.env") }));
expand(dotenv.config({ path: path.resolve(__dirname, "../../../../.env") }));

const db = drizzle(process.env.DATABASE_URL!, { schema });

const resend = new Resend(process.env.RESEND_API_KEY!);
const emailFrom =
	process.env.EMAIL_FROM ?? "Orbit <onboarding@resend.dev>";
const appUrl = process.env.APP_URL ?? "http://localhost:5173";

async function sendEmail(
	to: string,
	template: { subject: string; html: string },
): Promise<void> {
	await resend.emails.send({
		from: emailFrom,
		to: [to],
		subject: template.subject,
		html: template.html,
	});
}

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
	},

	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			void sendEmail(user.email, verifyEmailTemplate(user.name, url));
		},
		afterEmailVerification: async (user) => {
			void sendEmail(user.email, welcomeEmail(user.name));
		},
	},

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			void sendEmail(user.email, resetPasswordEmail(user.name, url));
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
				void sendEmail(
					data.email,
					invitationEmail({
						inviterName: data.inviter.user.name,
						organizationName: data.organization.name,
						inviteUrl: `${appUrl}/invite/${data.id}`,
					}),
				);
			},

			organizationHooks: {
				afterCreateOrganization: async ({ organization: org, user: owner }) => {
					void sendEmail(
						owner.email,
						workspaceCreatedEmail({
							ownerName: owner.name,
							organizationName: org.name,
							workspaceUrl: `${appUrl}/${org.slug}`,
						}),
					);
				},

				afterAcceptInvitation: async ({
					invitation,
					user: newMember,
					organization: org,
				}) => {
					const inviter = await db.query.user.findFirst({
						where: eq(schema.user.id, invitation.inviterId),
					});
					if (inviter) {
						void sendEmail(
							inviter.email,
							memberJoinedEmail({
								newMemberName: newMember.name,
								newMemberEmail: newMember.email,
								organizationName: org.name,
								workspaceUrl: `${appUrl}/${org.slug}`,
							}),
						);
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
