import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/inbox")({
	component: InboxPage,
});

function InboxPage() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
			<h1 className="text-lg font-semibold">Inbox</h1>
			<p className="text-sm text-muted-foreground">Coming soon.</p>
		</div>
	);
}
