import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import {
	type InvitationEmailData,
	invitationEmail,
} from "./templates/invitation";
import {
	type MemberJoinedEmailData,
	memberJoinedEmail,
} from "./templates/member-joined";
import { resetPasswordEmail } from "./templates/reset-password";
import { verifyEmailTemplate } from "./templates/verify-email";
import { welcomeEmail } from "./templates/welcome";
import {
	type WorkspaceCreatedEmailData,
	workspaceCreatedEmail,
} from "./templates/workspace-created";

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);
	private readonly resend: Resend;
	private readonly from: string;

	constructor(readonly config: ConfigService) {
		this.resend = new Resend(config.get<string>("RESEND_API_KEY"));
		this.from =
			config.get<string>("EMAIL_FROM") ?? "Orbit <onboarding@resend.dev>";
	}

	async sendVerifyEmail(to: string, name: string, url: string): Promise<void> {
		await this.send(to, verifyEmailTemplate(name, url));
	}

	async sendWelcome(to: string, name: string): Promise<void> {
		await this.send(to, welcomeEmail(name));
	}

	async sendResetPassword(
		to: string,
		name: string,
		url: string,
	): Promise<void> {
		await this.send(to, resetPasswordEmail(name, url));
	}

	async sendInvitation(to: string, data: InvitationEmailData): Promise<void> {
		await this.send(to, invitationEmail(data));
	}

	async sendWorkspaceCreated(
		to: string,
		data: WorkspaceCreatedEmailData,
	): Promise<void> {
		await this.send(to, workspaceCreatedEmail(data));
	}

	async sendMemberJoined(
		to: string,
		data: MemberJoinedEmailData,
	): Promise<void> {
		await this.send(to, memberJoinedEmail(data));
	}

	private async send(
		to: string,
		template: { subject: string; html: string },
	): Promise<void> {
		const { error } = await this.resend.emails.send({
			from: this.from,
			to: [to],
			subject: template.subject,
			html: template.html,
		});
		if (error) {
			this.logger.error(`Failed to send email to ${to}: ${error.message}`);
		}
	}
}
