import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { updateUserPreferencesSchema } from "@orbit/shared";
import type { User } from "../auth/auth.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthGuard } from "../common/guards/auth.guard";
import { PreferencesService } from "./preferences.service";

const DEFAULT_PREFERENCES = {
	theme: "system",
	language: "en",
	dateFormat: "DD/MM/YYYY",
weekStart: 0,
} as const;

@Controller("preferences")
@UseGuards(AuthGuard)
export class PreferencesController {
	constructor(private readonly preferencesService: PreferencesService) {}

	@Get()
	async getPreferences(@CurrentUser() user: User) {
		const row = await this.preferencesService.getPreferences(user.id);
		return row ?? DEFAULT_PREFERENCES;
	}

	@Patch()
	async upsertPreferences(@CurrentUser() user: User, @Body() body: unknown) {
		const data = updateUserPreferencesSchema.parse(body);
		return this.preferencesService.upsertPreferences(user.id, data);
	}
}
