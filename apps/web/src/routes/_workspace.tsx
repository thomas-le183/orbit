import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { loadAuthState } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);

		if (!state.session?.user) {
			throw redirect({ to: "/login" });
		}

		if (!state.session.user.name) {
			throw redirect({ to: "/onboarding" });
		}

		if (state.organizations.length === 0) {
			throw redirect({ to: "/create-workspace" });
		}

		// Expose the validated auth state to child routes so they can do
		// slug-level decisions without calling `ensureQueryData` again.
		return { authState: state };
	},
	component: Outlet,
});
