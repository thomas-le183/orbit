import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	UseGuards,
} from "@nestjs/common";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { NotificationService } from "./notification.service";

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationController {
	constructor(private readonly notificationService: NotificationService) {}

	@Get()
	list(@CurrentUser() user: User) {
		return this.notificationService.list(user.id);
	}

	@Get("unread-count")
	unreadCount(@CurrentUser() user: User) {
		return this.notificationService
			.getUnreadCount(user.id)
			.then((count) => ({ count }));
	}

	@Patch(":id/read")
	markRead(@Param("id", ParseUUIDPipe) id: string) {
		return this.notificationService.markRead(id);
	}

	@Patch("read-all")
	markAllRead(@CurrentUser() user: User) {
		return this.notificationService.markAllRead(user.id);
	}
}
