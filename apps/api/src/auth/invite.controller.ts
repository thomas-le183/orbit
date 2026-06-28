import {
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";

@Controller("invite")
export class InviteController {
	constructor(@Inject(DB) private readonly db: Db) {}

	@Get(":id/preview")
	async preview(@Param("id") id: string) {
		const invitation = await this.db.query.invitation.findFirst({
			where: eq(schema.invitation.id, id),
			with: { organization: true },
		});

		if (
			!invitation ||
			invitation.status !== "pending" ||
			invitation.expiresAt < new Date()
		) {
			throw new NotFoundException("Invitation not found");
		}

		return {
			organizationName: invitation.organization.name,
			organizationLogo: invitation.organization.logo ?? null,
		};
	}
}
