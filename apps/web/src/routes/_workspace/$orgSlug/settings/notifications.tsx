import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/workspace/settings/settings-page";

export const Route = createFileRoute(
	"/_workspace/$orgSlug/settings/notifications",
)({
	component: NotificationsPage,
});

function NotificationsPage() {
	return (
		<SettingsPage
			title="Notifications"
			subtitle="Control how Orbit reaches out to you."
		>
			<div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
				Coming soon.
			</div>
		</SettingsPage>
	);
}
