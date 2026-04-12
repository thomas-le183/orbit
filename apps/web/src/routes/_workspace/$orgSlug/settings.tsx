import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your account and workspace preferences.
				</p>
			</div>
			<Outlet />
		</div>
	);
}
