import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Inject,
	Post,
	UseGuards,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { DB, type Db } from "../db/db.module";
import * as schema from "../db/schema";
import { StorageService } from "../storage/storage.service";
import { PresignUploadDto } from "./uploads.dto";

@UseGuards(AuthGuard)
@Controller("uploads")
export class UploadsController {
	constructor(
		private readonly storage: StorageService,
		@Inject(DB) private readonly db: Db,
	) {}

	@Post("presign")
	async presign(@CurrentUser() user: User, @Body() body: PresignUploadDto) {
		if (body.purpose === "logo" && !body.orgId) {
			throw new BadRequestException("orgId is required for logo uploads");
		}

		if (body.purpose === "logo") {
			const membership = await this.db.query.member.findFirst({
				where: and(
					eq(schema.member.userId, user.id),
					eq(schema.member.organizationId, body.orgId!),
				),
			});
			if (!membership) {
				throw new ForbiddenException("Not a member of this organization");
			}
			if (membership.role !== "owner" && membership.role !== "admin") {
				throw new ForbiddenException(
					"Only admins and owners can update the organization logo",
				);
			}
		}

		const rawExt = body.fileName.includes(".")
			? (body.fileName.split(".").pop() ?? "bin")
			: "bin";
		const ext = /^[a-z0-9]+$/i.test(rawExt) ? rawExt : "bin";
		const key =
			body.purpose === "avatar"
				? `avatars/${user.id}/${randomUUID()}.${ext}`
				: `logos/${body.orgId}/${randomUUID()}.${ext}`;

		const uploadUrl = await this.storage.generateBrowserPresignedUrl(
			key,
			body.mimeType,
		);
		const publicUrl = this.storage.getPublicUrl(key);

		return { uploadUrl, storageKey: key, publicUrl };
	}
}
