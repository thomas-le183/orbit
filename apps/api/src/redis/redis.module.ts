import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS = Symbol("REDIS");
export type RedisClient = Redis;

@Global()
@Module({
	providers: [
		{
			provide: REDIS,
			useFactory: (config: ConfigService): Redis => {
				return new Redis({
					host: config.getOrThrow<string>("REDIS_HOST"),
					port: config.getOrThrow<number>("REDIS_PORT"),
					password: config.getOrThrow<string>("REDIS_PASSWORD"),
					lazyConnect: true,
				});
			},
			inject: [ConfigService],
		},
	],
	exports: [REDIS],
})
export class RedisModule {}
