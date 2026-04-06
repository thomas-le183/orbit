import { config } from "dotenv";

config();

import { drizzle } from "drizzle-orm/node-postgres";
import type { Db } from "./db.module";
import * as schema from "./schema";

// ------------------------------------------------------------------
// Init seeds — run in every environment (staging, production, local)
// These are required baseline data: roles, system config, etc.
// ------------------------------------------------------------------
const initSeeds: { name: string; fn: (db: Db) => Promise<void> }[] = [
	// e.g. { name: "roles", fn: seedRoles },
];

// ------------------------------------------------------------------
// Dev seeds — local development only
// Fake users, test orgs, sample data. Never run in production.
// ------------------------------------------------------------------
const devSeeds: { name: string; fn: (db: Db) => Promise<void> }[] = [];

async function loadDevSeeds() {
	const { seedAuth } = await import("./seeds/dev/01-auth.js");
	devSeeds.push({ name: "auth", fn: seedAuth });
	// add more dev seeds here
}

// ------------------------------------------------------------------

const mode = process.argv[2] ?? "init"; // "init" | "dev"

async function run() {
	const db = drizzle(process.env.DATABASE_URL!, { schema });

	const seeds = mode === "dev" ? [...initSeeds, ...devSeeds] : initSeeds;

	if (seeds.length === 0) {
		console.log(`No seeds registered for mode "${mode}".`);
		return;
	}

	for (const { name, fn } of seeds) {
		console.log(`\n[${name}]`);
		await fn(db);
	}

	console.log("\nDone.");
}

if (mode === "dev") {
	loadDevSeeds()
		.then(run)
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
} else {
	run().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
