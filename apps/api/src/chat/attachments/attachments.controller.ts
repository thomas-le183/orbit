import { randomUUID } from "node:crypto";
import { Body, Controller, Post } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { StorageService } from "../../storage/storage.service";
import { PresignDto } from "./attachments.dto";

@Controller("attachments")
export class AttachmentsController {
	constructor(private readonly storageService: StorageService) {}

	@Post("presign")
	async presign(@Session() { user }: UserSession, @Body() body: PresignDto) {
		const storageKey = `${user.id}/${randomUUID()}/${body.fileName}`;
		const uploadUrl = await this.storageService.generatePresignedUploadUrl(
			storageKey,
			body.mimeType,
			body.fileSize,
		);
		return { uploadUrl, storageKey };
	}
}
