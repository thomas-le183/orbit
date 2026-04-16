import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/settings")({
	beforeLoad: ({ location, params }) => {
		if (
			location.pathname === `/${params.orgSlug}/settings` ||
			location.pathname === `/${params.orgSlug}/settings/`
		) {
			throw redirect({ to: "/$orgSlug/settings/profile", params });
		}
	},
	component: SettingsLayout,
});

function SettingsLayout() {
	return (
		<div className="-m-6 flex min-h-[calc(100%+3rem)]">
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-180 px-12 py-10">
					<Outlet />
				</div>
			</div>
		</div>
	);
}
