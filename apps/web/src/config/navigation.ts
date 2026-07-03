import {
	ActivityIcon,
	BellIcon,
	BookOpenIcon,
	BuildingIcon,
	ClockIcon,
	CreditCardIcon,
	HomeIcon,
	InboxIcon,
	LayoutDashboardIcon,
	SettingsIcon,
	SlidersHorizontalIcon,
	StarIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";

// ── Top-level modules (used by AppNav) ─────────────────────────────────────

export interface NavModule {
	to: string;
	icon: React.ElementType;
	label: string;
	exact: boolean;
}

export const modules: NavModule[] = [
	{ to: "/$orgSlug", icon: HomeIcon, label: "Home", exact: true },
];

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

// ── Module configs ─────────────────────────────────────────────────────────

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
					{
						icon: InboxIcon,
						label: "Inbox",
						to: `/${orgSlug}/inbox`,
						badge: 3,
					},
					{
						icon: ActivityIcon,
						label: "Activity",
						to: `/${orgSlug}/activity`,
					},
				],
			},
			{
				label: "Quick access",
				items: [
					{ icon: StarIcon, label: "Starred", to: `/${orgSlug}/starred` },
					{ icon: ClockIcon, label: "Recent", to: `/${orgSlug}/recent` },
				],
			},
			{
				label: "Others",
				items: [
					{
						icon: SettingsIcon,
						label: "Settings",
						to: `/${orgSlug}/settings`,
					},
					{
						icon: BookOpenIcon,
						label: "Documentation",
						to: `/${orgSlug}/docs`,
					},
				],
			},
		],
	};
}

function getSettingsConfig(
	orgSlug: string,
	role: "owner" | "admin" | "member" | null,
): ModuleConfig {
	const isAdmin = role === "owner" || role === "admin";
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
					{
						icon: SlidersHorizontalIcon,
						label: "Preferences",
						to: `/${orgSlug}/settings/preferences`,
					},
				],
			},
			...(isAdmin
				? [
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
					]
				: []),
		],
	};
}

// ── Module resolution ──────────────────────────────────────────────────────

export function resolveModule(
	pathname: string,
	orgSlug: string,
	role: "owner" | "admin" | "member" | null = null,
): ModuleConfig | null {
	const base = `/${orgSlug}/`;
	const segment = pathname.slice(base.length).split("/")[0];
	switch (segment) {
		case "":
			return getHomeConfig(orgSlug);
		case "inbox":
		case "activity":
		case "timeline":
		case "projects":
		case "starred":
		case "recent":
			return getHomeConfig(orgSlug);

		case "settings":
			return getSettingsConfig(orgSlug, role);
		default:
			return null;
	}
}
