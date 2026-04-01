import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { AuthController } from "./auth.controller";

export const AUTH = Symbol("AUTH");

export type Auth = ReturnType<typeof betterAuth>;

@Module({
	providers: [
		{
			provide: AUTH,
			useFactory: (db: Db, config: ConfigService) =>
				betterAuth({
					secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
					baseURL: config.getOrThrow<string>("BETTER_AUTH_URL"),
					trustedOrigins: config
						.getOrThrow<string>("CORS_ALLOWED_ORIGINS")
						.split(","),
					database: drizzleAdapter(db, {
						provider: "pg",
						schema,
					}),
					emailAndPassword: { enabled: true },
					plugins: [
						organization({
							allowUserToCreateOrganization: true,
							teams: {
								enabled: true,
							},
						}),
					],
				}),
			inject: [DB, ConfigService],
		},
	],
	controllers: [AuthController],
	exports: [AUTH],
})
export class AuthModule {}
