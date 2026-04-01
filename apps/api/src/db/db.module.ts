import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const DB = Symbol("DB");
export type Db = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
	providers: [
		{
			provide: DB,
			useFactory: (config: ConfigService) => {
				const url = config.getOrThrow<string>("DATABASE_URL");
				return drizzle(url, { schema });
			},
			inject: [ConfigService],
		},
	],
	exports: [DB],
})
export class DbModule {}
