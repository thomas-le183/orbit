import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuthRedirect } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace")({
	component: WorkspaceGuard,
});

function WorkspaceGuard() {
	const auth = useAuthRedirect();

	if (auth.status === "loading") {
		return <LoadingScreen />;
	}

	// Not authenticated — send to login
	if (auth.status === "unauthenticated") {
		return <Navigate to="/login" />;
	}

	// Needs onboarding or create-workspace — redirect away from workspace
	if (
		auth.redirect.to === "/onboarding" ||
		auth.redirect.to === "/create-workspace"
	) {
		return <Navigate to={auth.redirect.to} />;
	}

	return <Outlet />;
}

function LoadingScreen() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
		</div>
	);
}
