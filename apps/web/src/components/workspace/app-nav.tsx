import { buttonVariants } from "@orbit/ui/components/button";
import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import {
	BotIcon,
	ClockIcon,
	HomeIcon,
	MessageSquareIcon,
	PanelLeftCloseIcon,
	PanelLeftOpenIcon,
	SettingsIcon,
} from "lucide-react";

const modules = [
	{ to: "/$orgSlug", icon: HomeIcon, label: "Home", exact: true },
	{
		to: "/$orgSlug/chat",
		icon: MessageSquareIcon,
		label: "Chat",
		exact: false,
	},
	{ to: "/$orgSlug/time", icon: ClockIcon, label: "Time", exact: false },
	{ to: "/$orgSlug/ai", icon: BotIcon, label: "AI", exact: false },
] as const;

const navItemClass = cn(
	buttonVariants({ variant: "ghost", size: "icon-sm" }),
	"data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground",
);

export function AppNav({
	isSidebarCollapsed,
	onToggleSidebar,
}: {
	isSidebarCollapsed: boolean;
	onToggleSidebar: () => void;
}) {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	return (
		<div className="flex h-full w-11 shrink-0 flex-col items-center py-2 border-r">
			<nav className="flex flex-1 flex-col items-center gap-1 w-full">
				{modules.map(({ to, icon: Icon, label, exact }) => (
					<Link
						key={to}
						to={to}
						params={{ orgSlug }}
						title={label}
						activeOptions={{ exact }}
						className={navItemClass}
					>
						<Icon size={16} />
					</Link>
				))}
			</nav>

			<div className="flex flex-col items-center gap-1 w-full">
				<button
					type="button"
					title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
					onClick={onToggleSidebar}
					className={navItemClass}
				>
					{isSidebarCollapsed ? (
						<PanelLeftOpenIcon size={16} />
					) : (
						<PanelLeftCloseIcon size={16} />
					)}
				</button>
				<Link
					to="/$orgSlug/settings"
					params={{ orgSlug }}
					title="Settings"
					className={navItemClass}
				>
					<SettingsIcon size={16} />
				</Link>
			</div>
		</div>
	);
}
