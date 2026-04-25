import { randomUUID } from "node:crypto";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { User } from "../../auth/auth.constants";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { StorageService } from "../../storage/storage.service";
import { PresignDto } from "./attachments.dto";

@UseGuards(AuthGuard)
@Controller("attachments")
export class AttachmentsController {
	constructor(private readonly storageService: StorageService) {}

	@Post("presign")
	async presign(@CurrentUser() user: User, @Body() body: PresignDto) {
		const storageKey = `${user.id}/${randomUUID()}/${body.fileName}`;
		const uploadUrl = await this.storageService.generatePresignedUploadUrl(
			storageKey,
			body.mimeType,
			body.fileSize,
		);
		return { uploadUrl, storageKey };
	}
}
