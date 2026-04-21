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
import { Kbd } from "@orbit/ui/components/kbd";
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
import { useState } from "react";
import { OrgAvatar } from "@/components/common/org-avatar";
import { UserAvatar } from "@/components/common/user-avatar";
import { CommandMenu } from "@/components/workspace/command-menu";
import { useOrganizations, useSession, useSignOut } from "@/hooks/use-auth";

export function TopNav() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const router = useRouter();
	const signOut = useSignOut();
	const { data: session } = useSession();
	const { data: organizations } = useOrganizations();
	const activeOrganization = organizations?.find((o) => o.slug === orgSlug);
	const user = session?.user;
	const [commandOpen, setCommandOpen] = useState(false);

	function handleSignOut() {
		signOut.mutate(undefined, {
			onSuccess: () => router.navigate({ to: "/" }),
		});
	}

	return (
		<header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
			{/* Workspace selector */}
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" size={"sm"} />}>
					<OrgAvatar
						size="sm"
						name={activeOrganization?.name}
						logo={activeOrganization?.logo}
					/>
					{activeOrganization?.name ?? orgSlug}
					<ChevronsUpDownIcon className="size-3.5" />
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
							<OrgAvatar size="sm" name={org.name} logo={org.logo} />
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
				size={"sm"}
				className="w-full max-w-md hover:bg-muted"
				onClick={() => setCommandOpen(true)}
			>
				<SearchIcon className="size-4" />
				<span className="flex-1 text-left text-xs">Search...</span>
				<Kbd>Ctrl + K</Kbd>
			</Button>
			<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

			<div className="flex gap-2 items-center">
				{/* Theme picker */}
				<ModeToggle />

				{/* User menu */}
				<DropdownMenu>
					<DropdownMenuTrigger>
						<UserAvatar name={user?.name} image={user?.image} />
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="end" className="w-56">
						<DropdownMenuGroup>
							<DropdownMenuLabel className="flex items-center gap-2 p-2">
								<UserAvatar name={user?.name} image={user?.image} />
								<div className="flex min-w-0 flex-col text-foreground">
									<span className="truncate">{user?.name}</span>
									<span className="truncate text-xs">{user?.email}</span>
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
			</div>
		</header>
	);
}
