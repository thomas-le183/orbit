import {
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
} from "class-validator";

export class CreateChannelDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(80)
	declare name: string;

	@IsString()
	@IsOptional()
	@MaxLength(280)
	declare description?: string;

	@IsBoolean()
	@IsOptional()
	declare isPrivate?: boolean;
}

export class UpdateChannelDto {
	@IsString()
	@IsOptional()
	@MaxLength(80)
	declare name?: string;

	@IsString()
	@IsOptional()
	@MaxLength(280)
	declare description?: string;
}

export class AddChannelMemberDto {
	@IsUUID()
	declare userId: string;
}
