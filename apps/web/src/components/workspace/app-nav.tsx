import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import {
	BotIcon,
	ClockIcon,
	ListTodoIcon,
	MessageSquareIcon,
	PanelLeftCloseIcon,
	PanelLeftOpenIcon,
	SettingsIcon,
} from "lucide-react";

const modules = [
	{ to: "/$orgSlug/chat", icon: MessageSquareIcon, label: "Chat" },
	{ to: "/$orgSlug/tasks", icon: ListTodoIcon, label: "Tasks" },
	{ to: "/$orgSlug/time", icon: ClockIcon, label: "Time" },
	{ to: "/$orgSlug/ai", icon: BotIcon, label: "AI" },
] as const;

const navItemClass = cn(
	"relative flex h-auto w-full flex-col items-center justify-center gap-1 px-1 py-1.5",
	"text-tab-inactive-foreground transition-colors",
	"hover:bg-tab-hover-background hover:text-tab-hover-foreground",
	"[&.active]:text-tab-active-foreground",
	"[&.active]:before:absolute [&.active]:before:left-0 [&.active]:before:top-1 [&.active]:before:bottom-1",
	"[&.active]:before:w-0.5 [&.active]:before:rounded-r [&.active]:before:bg-tab-active-border-top",
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
		<div className="flex h-full w-11 shrink-0 flex-col items-center bg-tab-inactive-background py-2 border-r">
			<nav className="flex flex-1 flex-col items-center gap-1 w-full">
				{modules.map(({ to, icon: Icon, label }) => (
					<Link
						key={to}
						to={to}
						params={{ orgSlug }}
						title={label}
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
