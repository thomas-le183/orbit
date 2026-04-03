import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { AUTH } from "./auth.constants";
import { AuthController } from "./auth.controller";

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
					advanced: {
						cookiePrefix: "orbit",
						crossSubDomainCookies: {
							enabled: true,
							domain: config.get<string>("COOKIE_DOMAIN"),
						},
					},
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
