import { createFileRoute, redirect } from "@tanstack/react-router";
import { loadAuthState, resolveAuthenticatedLanding } from "@/hooks/use-auth";

export const Route = createFileRoute("/create-workspace")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);

		if (!state.session?.user) {
			throw redirect({ to: "/login" });
		}

		if (!state.session.user.name) {
			throw redirect({ to: "/onboarding" });
		}

		// User already has at least one org — they don't need to create one.
		if (state.organizations.length > 0) {
			const landing = resolveAuthenticatedLanding(state);
			if (landing) throw redirect(landing);
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/create-workspace"!</div>;
}
