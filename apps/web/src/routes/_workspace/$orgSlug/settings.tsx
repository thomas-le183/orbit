import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SettingsSidebar } from "@/components/workspace/settings-sidebar";
import { useOrgRole } from "@/hooks/use-auth";

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
	const { targetOrg } = Route.useRouteContext() as any;
	const role = useOrgRole(targetOrg.id);
	const isAdmin = role === "admin" || role === "owner";

	return (
		<div className="-m-6 flex min-h-[calc(100%+3rem)]">
			<SettingsSidebar isAdmin={isAdmin} />
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-180 px-12 py-10">
					<Outlet />
				</div>
			</div>
		</div>
	);
}
