import { Avatar, AvatarFallback } from "@orbit/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@orbit/ui/components/sidebar";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

export function NavUser({ orgSlug }: { orgSlug: string }) {
	const { data: session } = useSession();
	const router = useRouter();
	const user = session?.user;
	const initials = user?.name
		? user.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: "?";

	async function handleSignOut() {
		await signOut();
		router.navigate({ to: "/login" });
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger>
						<SidebarMenuButton size="lg">
							<Avatar className="size-8 rounded-lg">
								<AvatarFallback className="rounded-lg">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{user?.name ?? "User"}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{user?.email}
								</span>
							</div>
							<ChevronsUpDownIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="end" className="w-56">
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
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
