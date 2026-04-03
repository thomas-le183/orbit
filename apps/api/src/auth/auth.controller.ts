import { All, Controller, Inject, Req, Res } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";
import type { Request, Response } from "express";
import { AUTH, type Auth } from "./auth.constants";

@Controller("auth")
export class AuthController {
	constructor(@Inject(AUTH) private readonly auth: Auth) {}

	@All("*path")
	handler(@Req() req: Request, @Res() res: Response) {
		return toNodeHandler(this.auth)(req, res);
	}
}
