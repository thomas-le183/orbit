import type { Request } from "express";

export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
	ipAddress?: string | null;
	userAgent?: string | null;
	activeOrganizationId?: string | null;
}

export interface AuthenticatedRequest extends Request {
	session: Session;
	user: User;
}
