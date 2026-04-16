import {
	ActivityIcon,
	BarChartIcon,
	BellIcon,
	BotIcon,
	BuildingIcon,
	CalendarIcon,
	CheckSquareIcon,
	ClockIcon,
	CreditCardIcon,
	HomeIcon,
	InboxIcon,
	KanbanIcon,
	LayoutDashboardIcon,
	LayoutListIcon,
	ListIcon,
	MessageSquareIcon,
	PlusIcon,
	SettingsIcon,
	StarIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SidebarItem {
	icon: React.ElementType;
	label: string;
	to?: string;
	badge?: number;
	dot?: boolean;
}

export interface SidebarSection {
	label: string;
	items: SidebarItem[];
}

export interface ModuleConfig {
	icon: React.ElementType;
	title: string;
	action?: { icon: React.ElementType; label: string };
	sections: SidebarSection[];
}

// ── Module configs (hardcoded — real data per module is a future spec) ─────

function getHomeConfig(orgSlug: string): ModuleConfig {
	return {
		icon: HomeIcon,
		title: "Home",
		sections: [
			{
				label: "Overview",
				items: [
					{
						icon: LayoutDashboardIcon,
						label: "Dashboard",
						to: `/${orgSlug}`,
					},
					{ icon: InboxIcon, label: "Inbox", badge: 3 },
					{ icon: ActivityIcon, label: "Activity" },
				],
			},
			{
				label: "Quick access",
				items: [
					{ icon: StarIcon, label: "Starred" },
					{ icon: ClockIcon, label: "Recent" },
				],
			},
		],
	};
}

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
		icon: SettingsIcon,
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
						icon: UsersIcon,
						label: "Members",
						to: `/${orgSlug}/settings/members`,
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

export function resolveModule(
	pathname: string,
	orgSlug: string,
): ModuleConfig | null {
	const base = `/${orgSlug}/`;
	const segment = pathname.slice(base.length).split("/")[0];
	switch (segment) {
		case "":
			return getHomeConfig(orgSlug);
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
