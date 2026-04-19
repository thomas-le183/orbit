import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/tasks")({
	component: TasksLayout,
});

function TasksLayout() {
	return <Outlet />;
}
