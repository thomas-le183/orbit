import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";

export class PresignDto {
	@IsString()
	@IsNotEmpty()
	declare fileName: string;

	@IsString()
	@IsNotEmpty()
	declare mimeType: string;

	@IsInt()
	@Min(1)
	@Max(100 * 1024 * 1024) // 100 MB cap
	declare fileSize: number;
}
