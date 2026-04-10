import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../guards/auth.guard";

export const CurrentSession = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
		return request.session;
	},
);
