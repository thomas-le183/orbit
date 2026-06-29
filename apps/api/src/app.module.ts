import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { NotificationModule } from "./notifications/notification.module";
import { PreferencesModule } from "./preferences/preferences.module";
import { ProjectsModule } from "./projects/projects.module";
import { QueueModule } from "./queue/queue.module";
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
		QueueModule,
		StorageModule,
		EmailModule,
		AuthModule,
		BillingModule,
		ChatModule,
		NotificationModule,
		PreferencesModule,
		ProjectsModule,
		UploadsModule,
	],
})
export class AppModule {}
