import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@orbit/ui/components/resizable";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppNav } from "@/components/workspace/app-nav";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { TopNav } from "@/components/workspace/top-nav";
import {
	useOrganizations,
	useSession,
	useSetActiveOrganization,
} from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug")({
	component: OrgLayout,
});

function OrgLayout() {
	const { orgSlug } = Route.useParams();
	const { data: session } = useSession();
	const { data: organizations } = useOrganizations();
	const { mutate: setActive } = useSetActiveOrganization();

	const targetOrg = organizations?.find((o) => o.slug === orgSlug);
	const targetOrgId = targetOrg?.id;
	const activeOrgId = session?.session.activeOrganizationId;

	// Sync active org when slug changes
	useEffect(() => {
		if (targetOrgId && activeOrgId !== targetOrgId) {
			setActive(targetOrgId);
		}
	}, [targetOrgId, activeOrgId, setActive]);

	// Invalid slug — redirect to first org
	if (organizations && !targetOrg) {
		const fallback = organizations[0];
		if (!fallback) return <Navigate to="/create-workspace" />;
		return <Navigate to="/$orgSlug" params={{ orgSlug: fallback.slug }} />;
	}
	return (
		<div className="flex h-screen flex-col">
			<TopNav orgSlug={orgSlug} />
			<div className="flex flex-1 gap-2 overflow-hidden p-2">
				<AppNav orgSlug={orgSlug} />
				<ResizablePanelGroup orientation="horizontal">
					<ResizablePanel
						id="sidebar"
						defaultSize="15%"
						minSize="180px"
						maxSize="280px"
						collapsible
						collapsedSize={0}
						groupResizeBehavior="preserve-pixel-size"
					>
						<AppSidebar orgSlug={orgSlug} />
					</ResizablePanel>

					<ResizableHandle />

					<ResizablePanel id="main" defaultSize="85%">
						<main className="h-full overflow-auto p-6">
							<Outlet />
						</main>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	);
}
