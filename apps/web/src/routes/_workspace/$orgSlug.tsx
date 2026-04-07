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
import { AppNav } from "@/components/workspace/app-nav";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { TopNav } from "@/components/workspace/top-nav";
import { useOrganizations } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/$orgSlug")({
	beforeLoad: ({ context, params }) => {
		const { authState } = context;
		const targetOrg = authState.organizations.find(
			(o) => o.slug === params.orgSlug,
		);

		if (!targetOrg) {
			throw notFound();
		}

		// Fire-and-forget: sync the backend active org to match the URL.
		// The mutation's onSuccess intentionally only invalidates the
		// active-org cache key, not the session, so this does not cause any
		// `useSession` consumer to re-render mid-navigation.
		if (authState.session?.session.activeOrganizationId !== targetOrg.id) {
			void authClient.organization.setActive({ organizationId: targetOrg.id });
		}
	},
	component: OrgLayout,
	notFoundComponent: OrgNotFound,
});

function OrgLayout() {
	const { orgSlug } = Route.useParams();

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
