import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class FindOrCreateConversationDto {
	@IsArray()
	@ArrayMinSize(1)
	@IsUUID("all", { each: true })
	declare participantIds: string[];
}
