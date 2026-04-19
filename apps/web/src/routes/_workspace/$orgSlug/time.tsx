import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/time")({
	component: TimeLayout,
});

function TimeLayout() {
	return <Outlet />;
}
