import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { defineConfig } from "drizzle-kit";

expand(config());

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		// biome-ignore lint/style/noNonNullAssertion: Redundant non-null assertion
		url: process.env.DATABASE_URL!,
	},
});
