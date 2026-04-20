import { createFileRoute } from "@tanstack/react-router";
import { GeneralSettings } from "@/components/workspace/settings/general-settings";
import { useOrganizations, useOrgRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/workspace")(
	{
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
