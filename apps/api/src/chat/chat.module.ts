import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AttachmentsController } from "./attachments/attachments.controller";
import { ChannelsController } from "./channels/channels.controller";
import { ChannelsService } from "./channels/channels.service";
import { ChatGateway } from "./chat.gateway";
import { ConversationsController } from "./conversations/conversations.controller";
import { ConversationsService } from "./conversations/conversations.service";
import { MessagesController } from "./messages/messages.controller";
import { MessagesService } from "./messages/messages.service";
import { PresenceController } from "./presence/presence.controller";
import { PresenceService } from "./presence/presence.service";

@Module({
	imports: [AuthModule],
	controllers: [
		ChannelsController,
		ConversationsController,
		MessagesController,
		AttachmentsController,
		PresenceController,
	],
	providers: [
		ChatGateway,
		ChannelsService,
		ConversationsService,
		MessagesService,
		PresenceService,
	],
	exports: [MessagesService],
})
export class ChatModule {}
