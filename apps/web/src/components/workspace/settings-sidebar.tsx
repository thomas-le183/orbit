import { cn } from "@orbit/ui/lib/utils";
import { Link, useParams } from "@tanstack/react-router";

const itemClass = cn(
	"block rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/60",
	"transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
	"[&.active]:bg-sidebar-active [&.active]:text-sidebar-accent-foreground",
);

export function SettingsSidebar({ isAdmin }: { isAdmin: boolean }) {
	const { orgSlug } = useParams({ from: "/_workspace/$orgSlug" });
	const params = { orgSlug };

	return (
		<div className="flex h-full w-52.5 shrink-0 flex-col border-r bg-sidebar py-5">
			<nav className="flex flex-col gap-4 px-3">
				<div>
					<p className="mb-1 px-3 text-[11px] font-medium text-sidebar-foreground/40">
						Account
					</p>
					<div className="flex flex-col gap-0.5">
						<Link
							to="/$orgSlug/settings/profile"
							params={params}
							className={itemClass}
						>
							Profile
						</Link>
						<Link
							to="/$orgSlug/settings/notifications"
							params={params}
							className={itemClass}
						>
							Notifications
						</Link>
					</div>
				</div>

				{isAdmin && (
					<div>
						<p className="mb-1 px-3 text-[11px] font-medium text-sidebar-foreground/40">
							Workspace
						</p>
						<div className="flex flex-col gap-0.5">
							<Link
								to="/$orgSlug/settings/general"
								params={params}
								className={itemClass}
							>
								General
							</Link>
							<Link
								to="/$orgSlug/settings/billing"
								params={params}
								className={itemClass}
							>
								Billing
							</Link>
						</div>
					</div>
				)}
			</nav>
		</div>
	);
}
