import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_workspace/$orgSlug/settings/notifications",
)({
	component: NotificationsSettings,
});

function NotificationsSettings() {
	return (
		<div className="rounded-xl border p-5">
			<p className="text-sm text-muted-foreground">
				Notification preferences coming soon.
			</p>
		</div>
	);
}
