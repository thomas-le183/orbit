import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@orbit/ui/components/breadcrumb";
import { Button } from "@orbit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@orbit/ui/components/popover";
import { ScrollArea } from "@orbit/ui/components/scroll-area";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "@orbit/ui/components/sidebar";
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	useParams,
	useRouterState,
} from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { useEffect } from "react";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { resolveModule } from "@/config/navigation";
import { useOrganizations, useSetActiveOrganization } from "@/hooks/use-auth";
import {
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotifications,
	useUnreadNotificationCount,
} from "@/hooks/use-notifications";

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
	const { state } = useSidebar();

	const match = config?.sections
		.flatMap((section) => section.items.map((item) => ({ section, item })))
		.find(({ item }) => item.to && item.to === pathname);

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 px-4">
			{state === "collapsed" && <SidebarTrigger />}
			{match && (
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>{match.section.label}</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{match.item.label}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			)}
			<div className="ml-auto">
				<NotificationBell />
			</div>
		</header>
	);
}

function NotificationBell() {
	const { data: count = 0 } = useUnreadNotificationCount();
	const { data: notifications = [] } = useNotifications();
	const markRead = useMarkNotificationRead();
	const markAllRead = useMarkAllNotificationsRead();

	return (
		<Popover>
			<PopoverTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
				<BellIcon className="h-4 w-4" />
				{count > 0 && (
					<span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
						{count > 99 ? "99+" : count}
					</span>
				)}
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<span className="text-sm font-semibold">Notifications</span>
					{count > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-auto py-0 text-xs text-muted-foreground"
							onClick={() => markAllRead.mutate()}
						>
							Mark all read
						</Button>
					)}
				</div>
				<ScrollArea className="max-h-96">
					{notifications.length === 0 ? (
						<p className="px-4 py-8 text-center text-sm text-muted-foreground">
							No notifications yet
						</p>
					) : (
						<ul>
							{notifications.map((n) => (
								<li
									key={n.id}
									className={`flex cursor-pointer flex-col gap-0.5 border-b px-4 py-3 last:border-0 hover:bg-muted/50 ${!n.read ? "bg-muted/30" : ""}`}
									onClick={() => {
										if (!n.read) markRead.mutate(n.id);
									}}
								>
									<div className="flex items-start justify-between gap-2">
										<span className="text-sm font-medium leading-snug">
											{n.title}
										</span>
										{!n.read && (
											<span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
										)}
									</div>
									<span className="text-xs text-muted-foreground">{n.body}</span>
								</li>
							))}
						</ul>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
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
