import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth";

export const AuthModule = BetterAuthModule.forRoot({
	auth,
	bodyParser: {
		json: { limit: "2mb" },
		urlencoded: { limit: "2mb", extended: true },
	},
});
