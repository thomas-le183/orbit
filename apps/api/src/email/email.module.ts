import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { QUEUES } from "../queue/queue.constants";
import { EmailProcessor } from "./email.processor";
import { EmailService } from "./email.service";

@Module({
	imports: [BullModule.registerQueue({ name: QUEUES.EMAIL })],
	providers: [EmailService, EmailProcessor],
	exports: [],
})
export class EmailModule {}
