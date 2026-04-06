import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import type { authClient } from "@/lib/auth-client";
import { routeTree } from "./routeTree.gen.ts";

export type Session = Awaited<ReturnType<typeof authClient.getSession>>["data"];

export interface RouterContext {
	session: Session;
	orgSlug: string | null;
}

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		context: { session: null, orgSlug: null } satisfies RouterContext,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
