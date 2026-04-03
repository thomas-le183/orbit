import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
