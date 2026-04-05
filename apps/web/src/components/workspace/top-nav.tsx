import { getInitials } from "@orbit/shared";
import { Avatar, AvatarFallback } from "@orbit/ui/components/avatar";
import { Button } from "@orbit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import { Kbd, KbdGroup } from "@orbit/ui/components/kbd";
import { ModeToggle } from "@orbit/ui/components/mode-toggle";
import { Link, useRouter } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronsUpDownIcon,
	LogOutIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
} from "lucide-react";
import { authClient, signOut, useSession } from "@/lib/auth-client";

export function TopNav({ orgSlug }: { orgSlug: string }) {
	const { data: session } = useSession();
	const router = useRouter();
	const user = session?.user;
	const { data: organizations } = authClient.useListOrganizations();
	const { data: activeOrganization } = authClient.useActiveOrganization();
	const initials = user?.name ? getInitials(user.name) : "?";

	async function handleSignOut() {
		await signOut();
		router.navigate({ to: "/login" });
	}

	return (
		<header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
			{/* Workspace selector */}
			<DropdownMenu>
				<DropdownMenuTrigger>
					<Button variant="ghost" className="gap-2 font-semibold text-sm">
						{activeOrganization?.name ?? orgSlug}
						<ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-56">
					{organizations?.map((org) => (
						<DropdownMenuItem
							key={org.id}
							onSelect={() =>
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
					<DropdownMenuItem>
						<Link to="/create-workspace">
							<PlusIcon className="size-4" />
							Create workspace
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Global search trigger */}
			<Button
				variant="outline"
				className="mx-auto h-8 w-full max-w-md justify-start gap-2 text-sm text-muted-foreground"
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
					<Button variant="ghost" size="icon" className="shrink-0 rounded-full">
						<Avatar className="size-7">
							<AvatarFallback className="text-xs">{initials}</AvatarFallback>
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<div className="px-2 py-1.5 text-sm">
						<p className="font-medium">{user?.name ?? "User"}</p>
						<p className="text-xs text-muted-foreground">{user?.email}</p>
					</div>
					<DropdownMenuItem>
						<Link to="/$orgSlug/settings" params={{ orgSlug }}>
							<SettingsIcon />
							Settings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={handleSignOut}
						className="text-destructive focus:text-destructive"
					>
						<LogOutIcon />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}
