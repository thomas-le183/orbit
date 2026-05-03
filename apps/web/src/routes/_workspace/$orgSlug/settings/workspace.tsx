import { createFileRoute, redirect } from "@tanstack/react-router";
import { GeneralSettings } from "@/components/workspace/settings/general-settings";
import { loadOrgRole, useOrganizations, useOrgRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/workspace")(
	{
		beforeLoad: async ({ context, params }) => {
			const { authState, targetOrg } = context;
			const role = await loadOrgRole(
				context.queryClient,
				targetOrg.id,
				authState.user?.id ?? "",
			);
			if (role === "member" || role === null) {
				throw redirect({ to: "/$orgSlug", params });
			}
		},
		component: WorkspacePage,
	},
);

function WorkspacePage() {
	const { targetOrg } = Route.useRouteContext() as {
		targetOrg: { id: string };
	};
	const { data: orgs } = useOrganizations();
	const org = orgs?.find((o) => o.id === targetOrg.id);
	const role = useOrgRole(targetOrg.id);
	const isOwner = role === "owner";

	if (!org) return null;

	return (
		<GeneralSettings
			org={{ id: org.id, name: org.name, slug: org.slug ?? "", logo: org.logo }}
			isOwner={isOwner}
		/>
	);
}
