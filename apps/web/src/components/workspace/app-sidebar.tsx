import { Button } from "@orbit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
} from "@orbit/ui/components/sidebar";
import {
	useMatchRoute,
	useNavigate,
	useParams,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	LogOutIcon,
	MoonIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { OrgAvatar } from "@/components/common/org-avatar";
import { UserAvatar } from "@/components/common/user-avatar";
import { CommandMenu } from "@/components/workspace/command-menu";
import { resolveModule, type SidebarItem } from "@/config/navigation";
import { useOrganizations, useSession, useSignOut } from "@/hooks/use-auth";

export function AppSidebar() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const config = resolveModule(pathname, orgSlug);
	const [commandOpen, setCommandOpen] = useState(false);
	const navigate = useNavigate();
	const isSettings = pathname.startsWith(`/${orgSlug}/settings`);

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<div className="flex items-center gap-1">
					<div className="min-w-0 flex-1">
						<WorkspaceSwitcher orgSlug={orgSlug} />
					</div>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Search"
						onClick={() => setCommandOpen(true)}
						className="group-data-[collapsible=icon]:hidden"
					>
						<SearchIcon />
					</Button>
					<SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
				</div>
				<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
			</SidebarHeader>

			<SidebarContent>
				{isSettings && (
					<SidebarGroup>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Back to Home"
									onClick={() =>
										navigate({ to: "/$orgSlug", params: { orgSlug } })
									}
								>
									<ArrowLeftIcon />
									<span>Back to Home</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroup>
				)}
				{config?.sections.map((section, index) => (
					<SidebarGroup key={section.label}>
						<SidebarGroupLabel>{section.label}</SidebarGroupLabel>
						{index === 0 && config.action && (
							<SidebarGroupAction title={config.action.label}>
								<config.action.icon />
							</SidebarGroupAction>
						)}
						<SidebarMenu>
							{section.items.map((item) => (
								<ModuleSidebarItem
									key={item.label}
									item={item}
									orgSlug={orgSlug}
								/>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<UserMenu />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

function WorkspaceSwitcher({ orgSlug }: { orgSlug: string }) {
	const router = useRouter();
	const { data: organizations } = useOrganizations();
	const activeOrganization = organizations?.find((o) => o.slug === orgSlug);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								tooltip={activeOrganization?.name ?? orgSlug}
							/>
						}
					>
						<OrgAvatar
							size="sm"
							name={activeOrganization?.name}
							logo={activeOrganization?.logo}
						/>
						<span className="flex-1 truncate font-medium">
							{activeOrganization?.name ?? orgSlug}
						</span>
						<ChevronsUpDownIcon className="size-3.5 shrink-0" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="bottom" className="w-56">
						{organizations?.map((org) => (
							<DropdownMenuItem
								key={org.id}
								onClick={() =>
									router.navigate({
										to: "/$orgSlug",
										params: { orgSlug: org.slug },
									})
								}
							>
								<OrgAvatar size="sm" name={org.name} logo={org.logo} />
								<span className="flex-1 truncate">{org.name}</span>
								{org.slug === orgSlug && <CheckIcon className="size-4" />}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => router.navigate({ to: "/create-workspace" })}
						>
							<PlusIcon className="size-4" />
							Create workspace
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

function UserMenu() {
	const router = useRouter();
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const { data: session } = useSession();
	const signOut = useSignOut();
	const { setTheme } = useTheme();
	const user = session?.user;

	function handleSignOut() {
		signOut.mutate(undefined, {
			onSuccess: () => router.navigate({ to: "/" }),
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<SidebarMenuButton size="lg" tooltip={user?.name ?? "Account"} />
				}
			>
				<UserAvatar name={user?.name} image={user?.image} />
				<div className="flex min-w-0 flex-1 flex-col text-left">
					<span className="truncate text-sm">{user?.name}</span>
					<span className="truncate text-xs text-muted-foreground">
						{user?.email}
					</span>
				</div>
				<ChevronsUpDownIcon className="size-3.5 shrink-0" />
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="flex items-center gap-2 p-2">
						<UserAvatar name={user?.name} image={user?.image} />
						<div className="flex min-w-0 flex-col">
							<span className="truncate">{user?.name}</span>
							<span className="truncate text-xs">{user?.email}</span>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => setTheme("light")}>
					<SunIcon />
					Light
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					<MoonIcon />
					Dark
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() =>
						router.navigate({
							to: "/$orgSlug/settings",
							params: { orgSlug },
							search: {},
						})
					}
				>
					<SettingsIcon />
					Settings
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onClick={handleSignOut}>
					<LogOutIcon />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ModuleSidebarItem({
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
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={item.label}
				isActive={isActive}
				onClick={() => item.to && navigate({ to: item.to })}
			>
				<Icon />
				<span>{item.label}</span>
			</SidebarMenuButton>
			{item.badge !== undefined && (
				<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
			)}
		</SidebarMenuItem>
	);
}
