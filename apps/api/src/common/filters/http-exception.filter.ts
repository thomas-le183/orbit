import {
  type ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

const STATUS_CODE_MAP: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      let message: string;
      let code: string;

      if (typeof res === "string") {
        message = res;
        code = STATUS_CODE_MAP[status] ?? `HTTP_${status}`;
      } else {
        const body = res as Record<string, unknown>;
        const raw = body.message;
        message = Array.isArray(raw)
          ? (raw as string[]).join("; ")
          : typeof raw === "string"
            ? raw
            : exception.message;
        code =
          typeof body.code === "string"
            ? body.code
            : (STATUS_CODE_MAP[status] ?? `HTTP_${status}`);
      }

      response.status(status).json({ statusCode: status, message, code });
      return;
    }

    this.logger.error(
      "Unhandled exception",
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(500).json({
      statusCode: 500,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
