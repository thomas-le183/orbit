import {
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Max,
	Min,
} from "class-validator";

export class PresignUploadDto {
	@Matches(/^image\/(jpeg|png|gif|webp)$/)
	declare mimeType: string;

	// Validated client-side only; not forwarded to the presigner (browsers cannot set Content-Length).
	@IsInt()
	@Min(1)
	@Max(10 * 1024 * 1024)
	declare fileSize: number;

	@IsString()
	@IsNotEmpty()
	declare fileName: string;

	@IsIn(["avatar", "logo"])
	declare purpose: "avatar" | "logo";

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	declare orgId?: string;
}
