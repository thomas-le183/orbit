import { Body, Controller, Get, Patch } from "@nestjs/common";
import { updateUserPreferencesSchema } from "@orbit/shared";
import type { User } from "../auth/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PreferencesService } from "./preferences.service";

const DEFAULT_PREFERENCES = {
	theme: "system",
	language: "en",
	dateFormat: "DD/MM/YYYY",
	weekStart: 0,
} as const;

@Controller("preferences")
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
