import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/time/month")({
	component: TimeMonthPage,
});

function TimeMonthPage() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
			<h1 className="text-lg font-semibold">This month</h1>
			<p className="text-sm text-muted-foreground">Coming soon.</p>
		</div>
	);
}
