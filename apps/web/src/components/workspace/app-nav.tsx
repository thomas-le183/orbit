import { cn } from "@orbit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
	BookOpenIcon,
	BotIcon,
	HomeIcon,
	MessageSquareIcon,
} from "lucide-react";

const topItems = [
	{ to: "/$orgSlug", icon: HomeIcon, label: "Home" },
	{ to: "/$orgSlug/wiki", icon: BookOpenIcon, label: "Wiki" },
	{ to: "/$orgSlug/ai", icon: BotIcon, label: "AI" },
	{ to: "/$orgSlug/chat", icon: MessageSquareIcon, label: "Chat" },
] as const;

export function AppNav({ orgSlug }: { orgSlug: string }) {
	return (
		<div className="flex h-full flex-col items-center p-2 rounded-md">
			{/* Top nav */}
			<nav className="flex flex-1 flex-col items-center gap-1">
				{topItems.map(({ to, icon: Icon, label }) => {
					const isProjects = to === "/$orgSlug";
					return (
						<Link
							key={to}
							to={to}
							params={{ orgSlug }}
							activeOptions={{ exact: isProjects }}
							className={cn(
								"group flex w-full flex-col items-center gap-0.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground",
							)}
						>
							<div
								className={cn(
									"flex items-center justify-center rounded-lg p-2 transition-colors group-hover:bg-accent in-[.active]:bg-accent",
								)}
							>
								<Icon size={16} />
							</div>
							<span className="leading-tight">{label}</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
