import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DbModule } from "../db/db.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
	imports: [AuthModule, DbModule],
	providers: [BillingService],
	controllers: [BillingController],
	exports: [BillingService],
})
export class BillingModule {}
