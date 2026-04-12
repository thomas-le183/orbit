import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import {
	BotIcon,
	ClockIcon,
	ListTodoIcon,
	MessageSquareIcon,
	Settings2Icon,
} from "lucide-react";

const modules = [
	{ to: "/$orgSlug/chat", icon: MessageSquareIcon, label: "Chat" },
	{ to: "/$orgSlug/tasks", icon: ListTodoIcon, label: "Tasks" },
	{ to: "/$orgSlug/time", icon: ClockIcon, label: "Time" },
	{ to: "/$orgSlug/ai", icon: BotIcon, label: "AI" },
] as const;

export function AppNav() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	return (
		<div className="flex h-full w-11 shrink-0 flex-col items-center bg-nav-chrome py-2 border-r">
			<nav className="flex flex-1 flex-col items-center gap-1 w-full">
				{modules.map(({ to, icon: Icon, label }) => (
					<Link
						key={to}
						to={to}
						params={{ orgSlug }}
						title={label}
						className={cn(
							"relative flex h-auto w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-nav-chrome-fg/60 transition-colors hover:text-nav-chrome-fg",
							"[&.active]:text-nav-chrome-fg [&.active]:before:absolute [&.active]:before:left-0 [&.active]:before:top-1 [&.active]:before:bottom-1 [&.active]:before:w-0.5 [&.active]:before:rounded-r [&.active]:before:bg-primary",
						)}
					>
						<Icon size={16} />
						{/* <span className="text-[10px] leading-none">{label}</span> */}
					</Link>
				))}
			</nav>

			<Link
				to="/$orgSlug/settings"
				params={{ orgSlug }}
				title="Settings"
				className="relative flex h-auto w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-nav-chrome-fg/60 transition-colors hover:text-nav-chrome-fg [&.active]:text-nav-chrome-fg [&.active]:before:absolute [&.active]:before:left-0 [&.active]:before:top-1 [&.active]:before:bottom-1 [&.active]:before:w-0.5 [&.active]:before:rounded-r [&.active]:before:bg-primary"
			>
				<Settings2Icon size={16} />
				<span className="text-[10px] leading-none">Settings</span>
			</Link>
		</div>
	);
}
