import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { QUEUES } from "../queue/queue.constants";
import { NotificationController } from "./notification.controller";
import { NotificationProcessor } from "./notification.processor";
import { NotificationService } from "./notification.service";

@Module({
	imports: [AuthModule, BullModule.registerQueue({ name: QUEUES.NOTIFICATION })],
	providers: [NotificationService, NotificationProcessor],
	controllers: [NotificationController],
})
export class NotificationModule {}
