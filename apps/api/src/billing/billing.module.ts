import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
	imports: [AuthModule],
	providers: [StripeService, BillingService],
	controllers: [BillingController, StripeWebhookController],
	exports: [BillingService],
})
export class BillingModule {}
