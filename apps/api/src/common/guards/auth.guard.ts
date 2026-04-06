import {
	CanActivate,
	ExecutionContext,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import {
	AUTH,
	type Auth,
	type Session,
	type User,
} from "../../auth/auth.constants";

export interface AuthenticatedRequest extends Request {
	session: Session;
	user: User;
}

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(@Inject(AUTH) private readonly auth: Auth) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		const result = await this.auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});

		if (!result) {
			throw new UnauthorizedException("Invalid or expired session");
		}

		request.session = result.session;
		request.user = result.user;

		return true;
	}
}
