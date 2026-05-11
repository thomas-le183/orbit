import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { changeEmailTemplate } from "./templates/change-email";
import { deleteAccountEmail } from "./templates/delete-account";
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
	private readonly transporter: nodemailer.Transporter;
	private readonly from: string;

	constructor(readonly config: ConfigService) {
		this.transporter = nodemailer.createTransport({
			host: config.get<string>("SMTP_HOST") ?? "localhost",
			port: config.get<number>("SMTP_PORT") ?? 1025,
			secure: false,
			auth: config.get<string>("SMTP_USER")
				? {
						user: config.get<string>("SMTP_USER"),
						pass: config.get<string>("SMTP_PASS"),
					}
				: undefined,
		});
		this.from =
			config.get<string>("EMAIL_FROM") ?? "Orbit <orbit@localhost>";
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

	async sendChangeEmail(
		to: string,
		name: string,
		newEmail: string,
		url: string,
	): Promise<void> {
		await this.send(to, changeEmailTemplate(name, newEmail, url));
	}

	async sendDeleteAccount(to: string, name: string, url: string): Promise<void> {
		await this.send(to, deleteAccountEmail(name, url));
	}

	private async send(
		to: string,
		template: { subject: string; html: string },
	): Promise<void> {
		try {
			await this.transporter.sendMail({
				from: this.from,
				to,
				subject: template.subject,
				html: template.html,
			});
		} catch (err) {
			this.logger.error(
				`Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
