import { Link } from "@tanstack/react-router";
import { FolderKanbanIcon, HomeIcon, MessageSquareIcon } from "lucide-react";

const navItems = [
	{ to: "/$orgSlug/", icon: HomeIcon, label: "Home" },
	{ to: "/$orgSlug/projects", icon: FolderKanbanIcon, label: "Projects" },
	{ to: "/$orgSlug/chat", icon: MessageSquareIcon, label: "Chat" },
] as const;

export function AppSidebar({ orgSlug }: { orgSlug: string }) {
	return (
		<div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground rounded-l-md">
			{/* Nav */}
			<nav className="flex flex-1 flex-col gap-1 p-2">
				{/* {navItems.map(({ to, icon: Icon, label }) => (
					<Link
						key={to}
						to={to}
						params={{ orgSlug }}
						activeOptions={{ exact: false }}
						className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
					>
						<Icon className="size-4 shrink-0" />
						<span className="truncate">{label}</span>
					</Link>
				))} */}
			</nav>
		</div>
	);
}
