import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import { REDIS, RedisModule } from "../redis/redis.module";
import { DrizzleRedisCache } from "./drizzle-redis-cache";
import * as schema from "./schema";

export const DB = Symbol("DB");
export type Db = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
	imports: [RedisModule],
	providers: [
		{
			provide: DB,
			useFactory: (config: ConfigService, redis: Redis) => {
				const url = config.getOrThrow<string>("DATABASE_URL");
				return drizzle(url, { schema, cache: new DrizzleRedisCache(redis) });
			},
			inject: [ConfigService, REDIS],
		},
	],
	exports: [DB],
})
export class DbModule {}
