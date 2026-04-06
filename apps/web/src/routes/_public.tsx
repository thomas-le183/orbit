import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuthRedirect } from "@/hooks/use-auth";

export const Route = createFileRoute("/_public")({
	component: PublicGuard,
});

function PublicGuard() {
	const auth = useAuthRedirect();

	if (auth.status === "loading") return null;
	if (auth.status === "authenticated") {
		return <Navigate to={auth.redirect.to} params={auth.redirect.params} />;
	}

	return <Outlet />;
}


