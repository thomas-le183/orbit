import type { betterAuth } from "better-auth/minimal";

export const AUTH = Symbol("AUTH");

export type Auth = ReturnType<typeof betterAuth>;

/**
 * Shape of the user object returned by better-auth getSession().
 * Matches the `user` table schema.
 */
export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Shape of the session object returned by better-auth getSession().
 * Includes the `activeOrganizationId` field added by the organization plugin.
 */
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
