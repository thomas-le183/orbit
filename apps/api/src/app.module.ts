import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ChatModule } from "./chat/chat.module";
import { DbModule } from "./db/db.module";
import { StorageModule } from "./storage/storage.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
		DbModule,
		StorageModule,
		AuthModule,
		BillingModule,
		ChatModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
