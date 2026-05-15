import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Queue } from "bullmq";
import cookieParser from "cookie-parser";
import * as express from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LatencyInterceptor } from "./common/interceptors/latency.interceptor";
import { QUEUES } from "./queue/queue.constants";

const API_PREFIX = "api";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false, // registered selectively below; Better Auth needs the raw stream on /api/auth/*
		logger: ["error", "warn", "log", "debug", "verbose"],
	});

	// CORS first — preflight OPTIONS requests must get headers before any other middleware runs
	app.enableCors({
		origin: process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [],
		credentials: true,
	});

	app.use(cookieParser());

	// Better Auth reads the raw body stream on /api/auth/* — skip express.json() there
	app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
		if (req.path.startsWith(`/${API_PREFIX}/auth/`)) return next();
		express.json()(req, _res, next);
	});

	app.setGlobalPrefix(API_PREFIX);

	app.useGlobalFilters(new HttpExceptionFilter());
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

	if (process.env.NODE_ENV === "development") {
		// Adds artificial delay to every request to simulate real-world network latency in development
		app.useGlobalInterceptors(new LatencyInterceptor());

		// Bull Board: mounts a queue dashboard at /admin/queues so you can inspect
		// pending/active/failed jobs, retry failures, and pause queues without any extra tooling.
		// Uses direct Redis connection (bypassing NestJS DI) since main.ts runs outside the module graph.
		const redisConnection = {
			host: process.env.REDIS_HOST ?? "localhost",
			port: Number(process.env.REDIS_PORT ?? 6379),
			password: process.env.REDIS_PASSWORD || undefined,
		};
		const serverAdapter = new ExpressAdapter();
		serverAdapter.setBasePath("/admin/queues");
		createBullBoard({
			queues: Object.values(QUEUES).map(
				(name) => new BullMQAdapter(new Queue(name, { connection: redisConnection })),
			),
			serverAdapter,
		});
		app.use("/admin/queues", serverAdapter.getRouter());
	}

	await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
