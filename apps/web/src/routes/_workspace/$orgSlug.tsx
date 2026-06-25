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
import { AlertTriangle, BellIcon, Crown, Info, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { resolveModule } from "@/config/navigation";
import {
	useOrganizations,
	useOrgRole,
	useSetActiveOrganization,
} from "@/hooks/use-auth";

import { useBillingSummary, useConvertTrial, usePortal } from "@/hooks/use-billing";
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
				<SubscriptionStatusBanner />
				<main className="flex-1 overflow-auto p-6 bg-background-primary rounded-xl border border-border-medium">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

function SubscriptionStatusBanner() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { targetOrg } = Route.useRouteContext();
	const { data: summary } = useBillingSummary(orgSlug);
	const role = useOrgRole(targetOrg.id);
	const portal = usePortal(orgSlug);
	const convertTrial = useConvertTrial(orgSlug);

	const sub = summary?.subscription;
	if (!sub) return null;

	const canManage = role === "owner" || role === "admin";
	const base = `${import.meta.env.VITE_WEB_BASE_URL}/${orgSlug}/settings/billing`;

	const rawPeriodEnd = sub.periodEnd;
	const periodEnd = rawPeriodEnd
		? new Date(rawPeriodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
		: null;

	const daysRemaining = sub.status === "trialing" && rawPeriodEnd
		? Math.max(0, Math.ceil((new Date(rawPeriodEnd).getTime() - Date.now()) / 86_400_000))
		: null;

	const isCanceledWithAccess =
		sub.status === "canceled" &&
		rawPeriodEnd != null &&
		new Date(rawPeriodEnd).getTime() > Date.now();

	if (sub.status === "past_due") {
		return (
			<div className="flex items-center justify-between gap-4 border-b bg-(--color-red-bg) px-4 py-2.5">
				<div className="flex items-center gap-2 text-sm text-(--color-red-foreground)">
					<AlertTriangle className="size-4 shrink-0" />
					<span>
						<span className="font-semibold">Payment failed.</span>{" "}
						{canManage ? "Update your payment method to restore access." : "Contact your workspace admin to resolve this."}
					</span>
				</div>
				{canManage && (
					<Button size="sm" variant="outline"
						className="shrink-0 border-(--color-red-border) text-(--color-red-foreground) hover:bg-(--color-red-bg)"
						onClick={() => portal.mutate(undefined, { onError: () => toast.error("Could not open billing portal.") })}
						disabled={portal.isPending}
					>
						Fix payment
					</Button>
				)}
			</div>
		);
	}

	if (sub.status === "trialing") {
		return (
			<div className="flex items-center justify-between gap-4 border-b bg-(--color-amber-bg) px-4 py-2.5">
				<div className="flex items-center gap-2 text-sm text-(--color-amber-foreground)">
					<Crown className="size-4 shrink-0" />
					<span>
						<span className="font-semibold">
							Business trial{daysRemaining !== null ? ` — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left` : ""}
						</span>
						{periodEnd && <span className="ml-1 opacity-75">· Ends {periodEnd}</span>}
					</span>
				</div>
				{canManage && (
					<Button size="sm" variant="outline"
						className="shrink-0 border-(--color-amber-border) text-(--color-amber-foreground) hover:bg-(--color-amber-bg)"
						onClick={() => convertTrial.mutate(
							{ successUrl: `${base}?checkout=success&setup_session={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}?checkout=canceled` },
							{ onError: (e) => toast.error(e.message ?? "Could not start checkout.") },
						)}
						disabled={convertTrial.isPending}
					>
						Subscribe now
					</Button>
				)}
			</div>
		);
	}

	if (sub.cancelAtPeriodEnd && sub.status !== "canceled") {
		return (
			<div className="flex items-center justify-between gap-4 border-b bg-(--color-amber-bg) px-4 py-2.5">
				<div className="flex items-center gap-2 text-sm text-(--color-amber-foreground)">
					<TriangleAlert className="size-4 shrink-0" />
					<span>
						<span className="font-semibold">Subscription canceling.</span>
						{periodEnd && <span className="ml-1">Access until {periodEnd}.</span>}
					</span>
				</div>
				{canManage && (
					<Button size="sm" variant="outline"
						className="shrink-0 border-(--color-amber-border) text-(--color-amber-foreground) hover:bg-(--color-amber-bg)"
						onClick={() => portal.mutate(undefined, { onError: () => toast.error("Could not open billing portal.") })}
						disabled={portal.isPending}
					>
						Manage billing
					</Button>
				)}
			</div>
		);
	}

	if (isCanceledWithAccess) {
		return (
			<div className="flex items-center justify-between gap-4 border-b bg-(--color-gray-bg) px-4 py-2.5">
				<div className="flex items-center gap-2 text-sm text-(--color-gray-foreground)">
					<Info className="size-4 shrink-0" />
					<span>
						<span className="font-semibold">Subscription canceled.</span>
						{periodEnd && <span className="ml-1">Access until {periodEnd}.</span>}
					</span>
				</div>
				{canManage && (
					<Button size="sm" variant="outline"
						className="shrink-0"
						onClick={() => portal.mutate(undefined, { onError: () => toast.error("Could not open billing portal.") })}
						disabled={portal.isPending}
					>
						Resubscribe
					</Button>
				)}
			</div>
		);
	}

	return null;
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
