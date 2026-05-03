import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";

@Module({
	imports: [AuthModule],
	providers: [PreferencesService],
	controllers: [PreferencesController],
})
export class PreferencesModule {}
