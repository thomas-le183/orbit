import { getInitials } from "@orbit/shared";
import { Avatar, AvatarFallback } from "@orbit/ui/components/avatar";
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
import { Kbd, KbdGroup } from "@orbit/ui/components/kbd";
import { ModeToggle } from "@orbit/ui/components/mode-toggle";
import { useParams, useRouter } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronsUpDownIcon,
	LogOutIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
} from "lucide-react";
import { useOrganizations, useSession, useSignOut } from "@/hooks/use-auth";

export function TopNav() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const router = useRouter();
	const signOut = useSignOut();
	const { data: session } = useSession();
	const { data: organizations } = useOrganizations();
	const activeOrganization = organizations?.find((o) => o.slug === orgSlug);
	const user = session?.user;
	const initials = user?.name ? getInitials(user.name) : "?";

	function handleSignOut() {
		signOut.mutate(undefined, {
			onSuccess: () => router.navigate({ to: "/" }),
		});
	}

	return (
		<header className="flex h-11 shrink-0 items-center gap-4 border-b border-border bg-tab-inactive-background px-4">
			{/* Workspace selector */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							className="gap-2 font-semibold text-sm text-tab-inactive-foreground hover:bg-tab-hover-background"
						/>
					}
				>
					{activeOrganization?.name ?? orgSlug}
					<ChevronsUpDownIcon className="size-3.5 text-tab-inactive-foreground/50" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-56">
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
							<span className="flex-1 truncate">{org.name}</span>
							{org.slug === orgSlug && (
								<CheckIcon className="size-4 text-foreground" />
							)}
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

			{/* Global search trigger */}
			<Button
				variant="outline"
				className="mx-auto w-full max-w-md justify-start gap-2 border-tab-inactive-foreground/15 bg-tab-hover-background text-tab-inactive-foreground hover:bg-muted"
				onClick={() => {
					// TODO: open command palette
				}}
			>
				<SearchIcon className="size-4" />
				<span className="flex-1 text-left">Search...</span>
				<KbdGroup>
					<Kbd>Ctrl</Kbd>
					<span>+</span>
					<Kbd>K</Kbd>
				</KbdGroup>
			</Button>

			{/* Theme picker */}
			<ModeToggle />

			{/* User menu */}
			<DropdownMenu>
				<DropdownMenuTrigger>
					<Avatar>
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent side="top" align="end" className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel className="flex items-center gap-2 p-2 font-normal">
							<Avatar>
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
							<div className="flex min-w-0 flex-col">
								<span className="truncate text-sm font-medium">
									{user?.name}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{user?.email}
								</span>
							</div>
						</DropdownMenuLabel>
					</DropdownMenuGroup>
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
		</header>
	);
}
