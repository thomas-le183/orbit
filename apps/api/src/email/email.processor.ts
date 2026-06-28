import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { QUEUES } from "../queue/queue.constants";
import type { EmailJobData } from "./email.jobs";
import { EmailService } from "./email.service";

@Processor(QUEUES.EMAIL)
export class EmailProcessor extends WorkerHost {
	private readonly logger = new Logger(EmailProcessor.name);

	constructor(private readonly emailService: EmailService) {
		super();
	}

	async process(job: Job<EmailJobData>): Promise<void> {
		const { data } = job;

		switch (data.type) {
			case "send-verify-email":
				await this.emailService.sendVerifyEmail(data.to, data.name, data.url);
				break;
			case "send-welcome":
				await this.emailService.sendWelcome(data.to, data.name);
				break;
			case "send-reset-password":
				await this.emailService.sendResetPassword(data.to, data.name, data.url);
				break;
			case "send-invitation":
				await this.emailService.sendInvitation(data.to, data.data);
				break;
			case "send-workspace-created":
				await this.emailService.sendWorkspaceCreated(data.to, data.data);
				break;
			case "send-member-joined":
				await this.emailService.sendMemberJoined(data.to, data.data);
				break;
			case "send-change-email":
				await this.emailService.sendChangeEmail(
					data.to,
					data.name,
					data.newEmail,
					data.url,
				);
				break;
			case "send-delete-account":
				await this.emailService.sendDeleteAccount(data.to, data.name, data.url);
				break;
			default:
				this.logger.warn(
					`Unknown email job type: ${(data as EmailJobData).type}`,
				);
		}
	}
}
