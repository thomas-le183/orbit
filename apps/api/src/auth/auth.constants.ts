import type { betterAuth } from "better-auth/minimal";

export const AUTH = Symbol("AUTH");

export type Auth = ReturnType<typeof betterAuth>;
