import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { QUEUES } from "../queue/queue.constants";
import type { NotificationJobData } from "./notification.jobs";

@Processor(QUEUES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
	private readonly logger = new Logger(NotificationProcessor.name);

	constructor(@Inject(DB) private readonly db: Db) {
		super();
	}

	async process(job: Job<NotificationJobData>): Promise<void> {
		const { data } = job;

		try {
			switch (data.type) {
				case "member_joined":
					await this.db.insert(schema.notification).values({
						userId: data.recipientId,
						type: data.type,
						title: `${data.actorName} joined ${data.orgName}`,
						body: `${data.actorName} accepted your invitation and joined the workspace.`,
						metadata: { orgSlug: data.orgSlug },
					});
					break;

				case "channel_added":
					await this.db.insert(schema.notification).values({
						userId: data.recipientId,
						type: data.type,
						title: `Added to #${data.channelName}`,
						body: `${data.addedByName} added you to #${data.channelName}.`,
						metadata: { orgSlug: data.orgSlug },
					});
					break;

				default:
					this.logger.warn(
						`Unknown notification job type: ${(data as NotificationJobData).type}`,
					);
			}
		} catch (err) {
			this.logger.error(
				`Failed to create notification: ${err instanceof Error ? err.message : String(err)}`,
			);
			throw err;
		}
	}
}
