import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChannelsController } from "./channels/channels.controller";
import { ChannelsService } from "./channels/channels.service";
import { ConversationsController } from "./conversations/conversations.controller";
import { ConversationsService } from "./conversations/conversations.service";

@Module({
	imports: [AuthModule],
	controllers: [ChannelsController, ConversationsController],
	providers: [ChannelsService, ConversationsService],
})
export class ChatModule {}
