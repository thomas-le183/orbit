import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { EmailModule } from "./email/email.module";
import { StorageModule } from "./storage/storage.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			expandVariables: true,
			envFilePath: [".env", "../../.env"],
		}),
		DbModule,
		StorageModule,
		EmailModule,
		AuthModule,
		BillingModule,
		ChatModule,
	],
})
export class AppModule {}
