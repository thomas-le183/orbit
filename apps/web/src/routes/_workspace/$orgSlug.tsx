import { Button } from "@orbit/ui/components/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@orbit/ui/components/resizable";
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AppNav } from "@/components/workspace/app-nav";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { TopNav } from "@/components/workspace/top-nav";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug")({
	beforeLoad: ({ context, params }) => {
		const { authState } = context;
		const targetOrg = authState.organizations.find(
			(o) => o.slug === params.orgSlug,
		);

		if (!targetOrg) {
			throw notFound();
		}

		return { targetOrg };
	},
	component: OrgLayout,
	notFoundComponent: OrgNotFound,
});

function OrgLayout() {
	const { authState, targetOrg } = Route.useRouteContext();
	const setActive = useSetActiveOrganization();

	useEffect(() => {
		if (authState.session?.activeOrganizationId !== targetOrg.id) {
			setActive.mutate(targetOrg.id);
		}
	}, [authState.session?.activeOrganizationId, targetOrg.id, setActive.mutate]);

	return (
		<div className="flex h-screen flex-col">
			<TopNav />
			<div className="flex flex-1 overflow-hidden bg-nav-chrome">
				<AppNav />
				<ResizablePanelGroup
					orientation="horizontal"
				>
					<ResizablePanel
						id="sidebar"
						defaultSize="15%"
						minSize="180px"
						maxSize="280px"
						collapsible
						collapsedSize={0}
						groupResizeBehavior="preserve-pixel-size"
					>
						<AppSidebar />
					</ResizablePanel>

					<ResizableHandle />

					<ResizablePanel id="main" defaultSize="85%" className="bg-background">
						<main className="h-full overflow-auto p-6">
							<Outlet />
						</main>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	);
}

function OrgNotFound() {
	const { data: organizations } = useOrganizations();
	const fallback = organizations?.[0];

	return (
		<div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
			<h1 className="text-2xl font-semibold">Workspace not found</h1>
			<p className="max-w-md text-muted-foreground text-sm">
				The workspace you're looking for doesn't exist or you don't have access
				to it.
			</p>
			{fallback ? (
				<Button>
					<Link to="/$orgSlug" params={{ orgSlug: fallback.slug }}>
						Go to {fallback.name}
					</Link>
				</Button>
			) : (
				<Button>
					<Link to="/create-workspace">Create a workspace</Link>
				</Button>
			)}
		</div>
	);
}
