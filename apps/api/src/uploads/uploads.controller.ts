import { randomUUID } from "node:crypto";
import {
	BadRequestException,
	Body,
	Controller,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { StorageService } from "../storage/storage.service";
import { PresignUploadDto } from "./uploads.dto";

@UseGuards(AuthGuard)
@Controller("uploads")
export class UploadsController {
	constructor(private readonly storage: StorageService) {}

	@Post("presign")
	async presign(@CurrentUser() user: User, @Body() body: PresignUploadDto) {
		if (body.purpose === "logo" && !body.orgId) {
			throw new BadRequestException("orgId is required for logo uploads");
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
