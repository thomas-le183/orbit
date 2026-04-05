import type { authClient } from "@/lib/auth-client";

type Session = Awaited<ReturnType<typeof authClient.getSession>>["data"];

export interface RouterContext {
	session: Session;
	orgSlug: string | null;
}
