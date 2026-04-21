import { Button } from "@orbit/ui/components/button";
import { SidebarInset, SidebarProvider } from "@orbit/ui/components/sidebar";
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	useParams,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { resolveModule } from "@/config/navigation";
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
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="bg-background-tertiary">
				<PageHeader />
				<main className="flex-1 overflow-auto p-6 bg-background-primary rounded-xl border border-border-medium">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

function PageHeader() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const config = resolveModule(pathname, orgSlug);

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 px-4">
			<h1 className="text-sm font-medium">{config?.title}</h1>
		</header>
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
