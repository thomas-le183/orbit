import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePresenceDto {
	@IsString()
	@IsOptional()
	@IsIn(["online", "away", "offline"])
	status?: string;

	@IsString()
	@IsOptional()
	@MaxLength(100)
	customStatus?: string | null;

	@IsString()
	@IsOptional()
	@MaxLength(10)
	customStatusEmoji?: string | null;
}
