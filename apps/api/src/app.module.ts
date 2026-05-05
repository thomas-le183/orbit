import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { PreferencesModule } from "./preferences/preferences.module";
import { StorageModule } from "./storage/storage.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			expandVariables: true,
			envFilePath: [".env", "../../.env"],
		}),
		DbModule,
		StorageModule,
		AuthModule,
		BillingModule,
		ChatModule,
		PreferencesModule,
		UploadsModule,
	],
})
export class AppModule {}
