import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>This is Home page</div>;
}
