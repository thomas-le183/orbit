import { Button } from "@orbit/ui/components/button";
import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@orbit/ui/components/sidebar";

import {
	useMatchRoute,
	useNavigate,
	useParams,
	useRouterState,
} from "@tanstack/react-router";

import { resolveModule, type SidebarItem } from "@/config/navigation";

// ── Component ──────────────────────────────────────────────────────────────

export function AppSidebar() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const config = resolveModule(pathname, orgSlug);

	if (!config) return null;

	return (
		<SidebarProvider>
			<div>
				{/* Header */}
				<SidebarHeader className="p-4 pb-0">
					<div className="flex items-center justify-between">
						<span className="text-base">{config.title}</span>
						{config.action && (
							<Button
								type="button"
								size={"icon-xs"}
								variant={"secondary"}
								title={config.action.label}
							>
								<config.action.icon />
							</Button>
						)}
					</div>
				</SidebarHeader>

				{/* Sections */}
				<SidebarContent>
					{config.sections.map((section) => (
						<SidebarGroup key={section.label}>
							<SidebarGroupLabel>{section.label}</SidebarGroupLabel>
							{section.items.map((item) => (
								<SidebarNavItem
									key={item.label}
									item={item}
									orgSlug={orgSlug}
								/>
							))}
						</SidebarGroup>
					))}
				</SidebarContent>

				<SidebarFooter></SidebarFooter>
			</div>
		</SidebarProvider>
	);
}

function SidebarNavItem({
	item,
	orgSlug,
}: {
	item: SidebarItem;
	orgSlug: string;
}) {
	const Icon = item.icon;
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();

	const moduleHome = `/${orgSlug}`;
	const isActive = item.to
		? !!matchRoute({ to: item.to, fuzzy: item.to !== moduleHome })
		: false;

	return (
		<SidebarMenuItem onClick={() => item.to && navigate({ to: item.to })}>
			<SidebarMenuButton size={"sm"} isActive={isActive}>
				<Icon className="size-3.5 shrink-0" />
				<span className="flex-1 truncate">{item.label}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
