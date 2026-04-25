import path from "node:path";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import * as dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";

// Load env files the same way NestJS ConfigModule does (with variable expansion)
expand(dotenv.config({ path: path.resolve(__dirname, "../../.env") }));
expand(dotenv.config({ path: path.resolve(__dirname, "../../../../.env") }));

const db = drizzle(process.env.DATABASE_URL!, { schema });

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: process.env.BETTER_AUTH_URL!,
	trustedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "").split(","),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	advanced: {
		cookiePrefix: "orbit",
	},
	emailAndPassword: { enabled: true },
	user: {
		deleteUser: { enabled: true },
	},
	plugins: [
		organization({
			allowUserToCreateOrganization: true,
			teams: { enabled: true },
		}),
	],
});
