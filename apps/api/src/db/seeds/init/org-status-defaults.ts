import { ensureOrgDefaults } from "../../../projects/org-defaults";
import type { Db } from "../../db.module";
import * as schema from "../../schema";

export async function seedOrgStatusDefaults(db: Db): Promise<void> {
	const orgs = await db
		.select({ id: schema.organization.id })
		.from(schema.organization);
	for (const org of orgs) {
		await ensureOrgDefaults(db, org.id);
	}
	console.log(`Ensured status defaults for ${orgs.length} org(s).`);
}
