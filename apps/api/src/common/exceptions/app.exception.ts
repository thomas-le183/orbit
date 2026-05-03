import { HttpException } from "@nestjs/common";

export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status = 500,
  ) {
    super({ code, message }, status);
  }
}
