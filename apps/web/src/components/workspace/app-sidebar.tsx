import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
	BarChartIcon,
	BellIcon,
	BotIcon,
	BuildingIcon,
	CalendarIcon,
	CheckSquareIcon,
	ClockIcon,
	CreditCardIcon,
	InboxIcon,
	KanbanIcon,
	LayoutListIcon,
	ListIcon,
	MessageSquareIcon,
	PlusIcon,
	Settings2Icon,
	UserIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SidebarItem {
	icon: React.ElementType;
	label: string;
	to?: string;
	badge?: number;
	dot?: boolean;
}

interface SidebarSection {
	label: string;
	items: SidebarItem[];
}

interface ModuleConfig {
	icon: React.ElementType;
	title: string;
	action?: { icon: React.ElementType; label: string };
	sections: SidebarSection[];
}

// ── Module configs (hardcoded — real data per module is a future spec) ─────

function getChatConfig(): ModuleConfig {
	return {
		icon: MessageSquareIcon,
		title: "Chat",
		action: { icon: PlusIcon, label: "New channel" },
		sections: [
			{
				label: "Channels",
				items: [
					{ icon: ListIcon, label: "general" },
					{ icon: ListIcon, label: "design-system", badge: 3 },
					{ icon: ListIcon, label: "backend", dot: true },
					{ icon: ListIcon, label: "announcements" },
				],
			},
			{
				label: "Direct Messages",
				items: [
					{ icon: UserIcon, label: "Aria Chen", badge: 1 },
					{ icon: UserIcon, label: "James Park" },
				],
			},
		],
	};
}

function getTasksConfig(): ModuleConfig {
	return {
		icon: CheckSquareIcon,
		title: "Tasks",
		action: { icon: PlusIcon, label: "New task" },
		sections: [
			{
				label: "My Work",
				items: [
					{ icon: InboxIcon, label: "My tasks" },
					{ icon: UserIcon, label: "Assigned to me", badge: 5 },
				],
			},
			{
				label: "Projects",
				items: [
					{ icon: KanbanIcon, label: "Design system" },
					{ icon: KanbanIcon, label: "API v2" },
					{ icon: KanbanIcon, label: "Mobile app" },
				],
			},
			{
				label: "Views",
				items: [
					{ icon: KanbanIcon, label: "Board" },
					{ icon: LayoutListIcon, label: "Backlog" },
				],
			},
		],
	};
}

function getTimeConfig(): ModuleConfig {
	return {
		icon: ClockIcon,
		title: "Time",
		sections: [
			{
				label: "Tracking",
				items: [
					{ icon: ClockIcon, label: "Today" },
					{ icon: CalendarIcon, label: "This week" },
					{ icon: CalendarIcon, label: "This month" },
				],
			},
			{
				label: "Reports",
				items: [
					{ icon: BarChartIcon, label: "By project" },
					{ icon: BarChartIcon, label: "By member" },
				],
			},
			{
				label: "Projects",
				items: [
					{ icon: KanbanIcon, label: "Design system" },
					{ icon: KanbanIcon, label: "API v2" },
				],
			},
		],
	};
}

function getAiConfig(): ModuleConfig {
	return {
		icon: BotIcon,
		title: "AI Chat",
		action: { icon: PlusIcon, label: "New conversation" },
		sections: [
			{
				label: "Recent",
				items: [
					{ icon: MessageSquareIcon, label: "Refactor auth module" },
					{ icon: MessageSquareIcon, label: "Write API docs" },
					{ icon: MessageSquareIcon, label: "Debug websocket issue" },
					{ icon: MessageSquareIcon, label: "Design token naming" },
				],
			},
			{
				label: "This week",
				items: [
					{ icon: MessageSquareIcon, label: "DB schema review" },
					{ icon: MessageSquareIcon, label: "PR review notes" },
				],
			},
		],
	};
}

function getSettingsConfig(orgSlug: string): ModuleConfig {
	return {
		icon: Settings2Icon,
		title: "Settings",
		sections: [
			{
				label: "Account",
				items: [
					{
						icon: UserIcon,
						label: "Profile",
						to: `/${orgSlug}/settings/profile`,
					},
					{
						icon: BellIcon,
						label: "Notifications",
						to: `/${orgSlug}/settings/notifications`,
					},
				],
			},
			{
				label: "Workspace",
				items: [
					{
						icon: BuildingIcon,
						label: "General",
						to: `/${orgSlug}/settings/workspace`,
					},
					{
						icon: CreditCardIcon,
						label: "Billing",
						to: `/${orgSlug}/settings/billing`,
					},
				],
			},
		],
	};
}

// ── Module resolution ──────────────────────────────────────────────────────

function resolveModule(pathname: string, orgSlug: string): ModuleConfig | null {
	const base = `/${orgSlug}/`;
	const segment = pathname.slice(base.length).split("/")[0];
	switch (segment) {
		case "chat":
			return getChatConfig();
		case "tasks":
			return getTasksConfig();
		case "time":
			return getTimeConfig();
		case "ai":
			return getAiConfig();
		case "settings":
			return getSettingsConfig(orgSlug);
		default:
			return null;
	}
}

// ── Component ──────────────────────────────────────────────────────────────

export function AppSidebar() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const config = resolveModule(pathname, orgSlug);

	if (!config) return null;

	return (
		<div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
			{/* Header */}
			<div className="flex py-3 shrink-0 items-center gap-1 px-3">
				<span className="flex-1 font-mono text-[11px] font-thin uppercase tracking-widest text-sidebar-foreground/60">
					{config.title}
				</span>
				{config.action && (
					<button
						type="button"
						title={config.action.label}
						className="flex h-5 w-5 items-center justify-center rounded text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					>
						<config.action.icon className="size-3.5" />
					</button>
				)}
			</div>

			{/* Sections */}
			<nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2 pt-3">
				{config.sections.map((section) => (
					<div key={section.label}>
						<p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[1.2px] text-sidebar-foreground/40">
							{section.label}
						</p>
						<div className="flex flex-col gap-0.5">
							{section.items.map((item) => (
								<SidebarNavItem
									key={item.label}
									item={item}
									orgSlug={orgSlug}
								/>
							))}
						</div>
					</div>
				))}
			</nav>
		</div>
	);
}

function SidebarNavItem({
	item,
	orgSlug: _orgSlug,
}: {
	item: SidebarItem;
	orgSlug: string;
}) {
	const Icon = item.icon;
	const inner = (
		<>
			<Icon className="size-3.5 shrink-0" />
			<span className="flex-1 truncate text-[11px]">{item.label}</span>
			{item.badge != null && (
				<span className="rounded-full bg-primary px-1.5 py-px font-mono text-[9px] font-semibold text-primary-foreground">
					{item.badge}
				</span>
			)}
			{item.dot && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
		</>
	);

	const baseClass =
		"flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&.active]:bg-sidebar-active [&.active]:text-sidebar-accent-foreground";

	if (item.to) {
		return (
			<Link to={item.to} className={cn(baseClass)}>
				{inner}
			</Link>
		);
	}

	return <div className={cn(baseClass, "cursor-pointer")}>{inner}</div>;
}
