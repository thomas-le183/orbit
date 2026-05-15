import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QUEUES } from "./queue.constants";

@Global()
@Module({
	imports: [
		BullModule.forRootAsync({
			useFactory: (config: ConfigService) => ({
				connection: {
					host: config.getOrThrow<string>("REDIS_HOST"),
					port: config.getOrThrow<number>("REDIS_PORT"),
					password: config.getOrThrow<string>("REDIS_PASSWORD"),
				},
				defaultJobOptions: {
					attempts: 3,
					backoff: { type: "exponential", delay: 2000 },
					removeOnComplete: 100,
					removeOnFail: 500,
				},
			}),
			inject: [ConfigService],
		}),
		BullModule.registerQueue(
			{ name: QUEUES.EMAIL },
			{ name: QUEUES.BILLING },
			{ name: QUEUES.NOTIFICATION },
		),
	],
	exports: [BullModule],
})
export class QueueModule {}
