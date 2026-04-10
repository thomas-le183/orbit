import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { User } from "../../auth/auth.constants";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { StorageService } from "../../storage/storage.service";

@UseGuards(AuthGuard)
@Controller("attachments")
export class AttachmentsController {
	constructor(private readonly storageService: StorageService) {}

	@Post("presign")
	async presign(
		@CurrentUser() user: User,
		@Body() body: { fileName: string; mimeType: string; fileSize: number },
	) {
		// Key is namespaced to the user so the gateway can validate ownership
		const storageKey = `${user.id}/${randomUUID()}/${body.fileName}`;
		const uploadUrl = await this.storageService.generatePresignedUploadUrl(
			storageKey,
			body.mimeType,
		);
		return { uploadUrl, storageKey };
	}
}
