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

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024) // 10 MB cap
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
