import { createFileRoute, redirect } from "@tanstack/react-router";
import { loadAuthState, resolveAuthenticatedLanding } from "@/hooks/use-auth";

export const Route = createFileRoute("/onboarding")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);

		if (!state.user) {
			throw redirect({ to: "/login" });
		}

		// User already has a name — they don't belong on the onboarding
		// screen. Send them to their real landing destination.
		if (state.user.name) {
			const landing = resolveAuthenticatedLanding(state);
			if (landing) throw redirect(landing);
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/onboarding"!</div>;
}
