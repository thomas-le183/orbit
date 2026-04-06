import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { rawBody: true });

	app.setGlobalPrefix("api");

	app.use(cookieParser());

	app.enableCors({
		origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [],
		credentials: true,
	});

	await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
