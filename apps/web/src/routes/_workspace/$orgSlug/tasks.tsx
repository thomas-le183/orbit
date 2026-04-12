import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/tasks")({
	component: TasksPage,
});

function TasksPage() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
			<h1 className="text-lg font-semibold">Tasks</h1>
			<p className="text-sm text-muted-foreground">Coming soon.</p>
		</div>
	);
}
