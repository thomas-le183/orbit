import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { loadAuthState, resolveAuthenticatedLanding } from "@/hooks/use-auth";

export const Route = createFileRoute("/_public")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);
		const landing = resolveAuthenticatedLanding(state);
		if (landing) {
			throw redirect(landing);
		}
	},
	component: Outlet,
});
