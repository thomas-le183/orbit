import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LatencyInterceptor } from "./common/interceptors/latency.interceptor";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
		rawBody: true,
		logger: ["error", "warn", "log", "debug", "verbose"],
	});

	app.setGlobalPrefix("api");

	app.useGlobalFilters(new HttpExceptionFilter());

	app.useGlobalPipes(
		new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
	);

	if (process.env.NODE_ENV === "development") {
		app.useGlobalInterceptors(new LatencyInterceptor());
	}

	app.use(cookieParser());

	app.enableCors({
		origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [],
		credentials: true,
	});

	await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
