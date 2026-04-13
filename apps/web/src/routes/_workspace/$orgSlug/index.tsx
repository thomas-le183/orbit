import { cn } from "@orbit/ui/lib/utils";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
	BotIcon,
	CheckSquare2Icon,
	ClockIcon,
	MessageSquareIcon,
	TrendingUpIcon,
} from "lucide-react";

export const Route = createFileRoute("/_workspace/$orgSlug/")({
	component: DashboardPage,
});

function DashboardPage() {
	const { authState } = Route.useRouteContext();
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug/" });
	const user = authState.user;
	const firstName = user?.name?.split(" ")[0] ?? "there";
	const greeting = getGreeting();

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			{/* Header */}
			<div>
				<p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
					{formatDate(new Date())}
				</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
					{greeting}, {firstName}.
				</h1>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-4 gap-3">
				{stats.map((stat) => (
					<StatCard key={stat.label} {...stat} />
				))}
			</div>

			{/* Two-column body */}
			<div className="grid grid-cols-[1fr_280px] gap-6">
				{/* Activity feed */}
				<section>
					<SectionHeading>Recent activity</SectionHeading>
					<div className="mt-3 flex flex-col divide-y divide-border rounded-md border border-border bg-card">
						{activity.map((item, i) => (
							<ActivityRow key={i} item={item} />
						))}
					</div>
				</section>

				{/* Right column */}
				<aside className="space-y-6">
					{/* Module shortcuts */}
					<section>
						<SectionHeading>Jump to</SectionHeading>
						<div className="mt-3 grid grid-cols-2 gap-2">
							{modules.map(({ to, icon: Icon, label, color }) => (
								<Link
									key={to}
									to={to}
									params={{ orgSlug }}
									className={cn(
										"flex flex-col items-start gap-2 rounded-md border border-border bg-card p-3",
										"transition-colors hover:bg-list-hover-background hover:text-list-hover-foreground",
									)}
								>
									<div
										className="flex h-6 w-6 items-center justify-center rounded"
										style={{ background: color }}
									>
										<Icon className="size-3.5 text-white" />
									</div>
									<span className="text-xs font-medium text-foreground">
										{label}
									</span>
								</Link>
							))}
						</div>
					</section>

					{/* Upcoming tasks */}
					<section>
						<SectionHeading>Due soon</SectionHeading>
						<div className="mt-3 flex flex-col gap-1">
							{upcoming.map((task, i) => (
								<div
									key={i}
									className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-list-hover-background"
								>
									<CheckSquare2Icon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<p className="truncate text-[11px] text-foreground">
											{task.title}
										</p>
										<p className="text-[10px] text-muted-foreground">
											{task.due}
										</p>
									</div>
								</div>
							))}
						</div>
					</section>
				</aside>
			</div>
		</div>
	);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/60">
			{children}
		</h2>
	);
}

function StatCard({
	label,
	value,
	delta,
	positive,
}: {
	label: string;
	value: string;
	delta?: string;
	positive?: boolean;
}) {
	return (
		<div className="rounded-md border border-border bg-card p-3">
			<p className="font-mono text-[9px] uppercase tracking-[1.2px] text-muted-foreground/60">
				{label}
			</p>
			<p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
				{value}
			</p>
			{delta && (
				<p
					className={cn(
						"mt-1 flex items-center gap-1 font-mono text-[9px]",
						positive ? "text-green-500" : "text-destructive",
					)}
				>
					<TrendingUpIcon className="size-2.5" />
					{delta}
				</p>
			)}
		</div>
	);
}

function ActivityRow({
	item,
}: {
	item: {
		icon: React.ElementType;
		color: string;
		text: string;
		meta: string;
	};
}) {
	const Icon = item.icon;
	return (
		<div className="flex items-start gap-3 px-3 py-2.5">
			<div
				className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded"
				style={{ background: item.color }}
			>
				<Icon className="size-3 text-white" />
			</div>
			<div className="min-w-0 flex-1">
				<p
					className="text-[11px] text-foreground"
					dangerouslySetInnerHTML={{ __html: item.text }}
				/>
			</div>
			<p className="shrink-0 font-mono text-[9px] text-muted-foreground/50">
				{item.meta}
			</p>
		</div>
	);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
	const h = new Date().getHours();
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}

function formatDate(d: Date) {
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
}

// ── Static data ────────────────────────────────────────────────────────────

const stats = [
	{ label: "Open tasks", value: "12", delta: "+3 this week", positive: false },
	{ label: "Messages", value: "47", delta: "8 unread", positive: false },
	{
		label: "Hours this week",
		value: "23.5",
		delta: "+2.5 vs last",
		positive: true,
	},
	{ label: "Completed", value: "8", delta: "+5 this week", positive: true },
];

const modules = [
	{
		to: "/$orgSlug/chat" as const,
		icon: MessageSquareIcon,
		label: "Chat",
		color: "#0069CC",
	},
	{
		to: "/$orgSlug/time" as const,
		icon: ClockIcon,
		label: "Time",
		color: "#0ea5e9",
	},
	{
		to: "/$orgSlug/ai" as const,
		icon: BotIcon,
		label: "AI",
		color: "#8b5cf6",
	},
];

const activity = [
	{
		icon: CheckSquare2Icon,
		color: "#6366f1",
		text: "<b>Aria Chen</b> completed <b>Design system tokens</b>",
		meta: "2m ago",
	},
	{
		icon: MessageSquareIcon,
		color: "#0069CC",
		text: "<b>James Park</b> posted in <b>#backend</b>",
		meta: "14m ago",
	},
	{
		icon: CheckSquare2Icon,
		color: "#6366f1",
		text: "You assigned <b>API v2 schema review</b> to Aria",
		meta: "1h ago",
	},
	{
		icon: ClockIcon,
		color: "#0ea5e9",
		text: "You logged <b>3h 20m</b> on <b>Design system</b>",
		meta: "3h ago",
	},
	{
		icon: MessageSquareIcon,
		color: "#0069CC",
		text: "<b>4 new messages</b> in <b>#design-system</b>",
		meta: "5h ago",
	},
];

const upcoming = [
	{ title: "Finalize API v2 schema", due: "Today" },
	{ title: "Review mobile app PR", due: "Tomorrow" },
	{ title: "Write release notes", due: "Apr 15" },
	{ title: "Sync with design team", due: "Apr 16" },
];
