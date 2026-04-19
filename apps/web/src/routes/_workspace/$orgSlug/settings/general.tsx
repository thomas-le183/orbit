import { createFileRoute } from "@tanstack/react-router";
import { GeneralSettings } from "@/components/workspace/settings/general-settings";
import { useOrganizations, useOrgRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/general")({
	component: GeneralPage,
});

function GeneralPage() {
	const { targetOrg } = Route.useRouteContext() as any;
	const { data: orgs } = useOrganizations();
	const org = orgs?.find((o: any) => o.id === targetOrg.id);
	const role = useOrgRole(targetOrg.id);
	const isOwner = role === "owner";

	if (!org) return null;

	return <GeneralSettings org={org} isOwner={isOwner} />;
}
