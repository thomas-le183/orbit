import { Button } from "@orbit/ui/components/button";
import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { resolveModule, type SidebarItem } from "./sidebar-configs";

// ── Component ──────────────────────────────────────────────────────────────

export function AppSidebar() {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const config = resolveModule(pathname, orgSlug);

	if (!config) return null;

	return (
		<div className="flex h-full w-full flex-col">
			{/* Header */}
			<div className="flex py-3 shrink-0 items-center gap-1 px-3">
				<span className="flex-1 text-base">{config.title}</span>
				{config.action && (
					<Button
						type="button"
						size={"icon-xs"}
						variant={"secondary"}
						title={config.action.label}
					>
						<config.action.icon />
					</Button>
				)}
			</div>

			{/* Sections */}
			<nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2 pt-3">
				{config.sections.map((section) => (
					<div key={section.label}>
						<p className="mb-1 px-2 font-mono text-xs uppercase tracking-[1.2px]">
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
			<span className="flex-1 truncate">{item.label}</span>
			{item.badge != null && (
				<span className="rounded-full bg-primary px-1.5 py-px font-mono text-[9px] font-semibold text-primary-foreground">
					{item.badge}
				</span>
			)}
			{item.dot && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
		</>
	);

	const baseClass =
		"flex items-center gap-2 rounded-md px-2 py-1.5 text-foreground/70 transition-colors hover:bg-list-hover-background hover:text-list-hover-foreground [&.active]:bg-list-active-selection-background [&.active]:text-list-active-selection-foreground";

	if (item.to) {
		return (
			<Link to={item.to} className={cn(baseClass)}>
				{inner}
			</Link>
		);
	}

	return <div className={cn(baseClass, "cursor-pointer")}>{inner}</div>;
}
