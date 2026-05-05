import { Body, Controller, Get, Patch } from "@nestjs/common";
import { updateUserPreferencesSchema } from "@orbit/shared";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
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
	async getPreferences(@Session() { user }: UserSession) {
		const row = await this.preferencesService.getPreferences(user.id);
		return row ?? DEFAULT_PREFERENCES;
	}

	@Patch()
	async upsertPreferences(@Session() { user }: UserSession, @Body() body: unknown) {
		const data = updateUserPreferencesSchema.parse(body);
		return this.preferencesService.upsertPreferences(user.id, data);
	}
}
