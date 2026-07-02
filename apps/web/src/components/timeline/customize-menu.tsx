import { Button } from "@orbit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import { Switch } from "@orbit/ui/components/switch";
import { ArrowDownUp, Group, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

/** "Soon" tag on options that are scaffolded but not yet wired. */
function SoonTag() {
	return (
		<span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
			Soon
		</span>
	);
}

/**
 * Icon-only toolbar menu gathering the view switcher and table view options.
 * `table` options are only shown when a table is present (timeline layout);
 * sort/group are scaffolded placeholders to be wired as follow-ups.
 */
export default function CustomizeMenu({
	viewSwitch,
	table,
}: {
	/** The layout switcher control, shown at the top of the menu. */
	viewSwitch: ReactNode;
	/** Table view controls; omit for layouts without a table (e.g. scheduler). */
	table?: { collapsed: boolean; onToggle: () => void };
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="outline" size="icon-sm" />}
				data-testid="customize-trigger"
				aria-label="Customize view"
				title="Customize view"
			>
				<SlidersHorizontal className="size-4 opacity-70" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				<div className="p-1">{viewSwitch}</div>

				{table && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem disabled>
							<ArrowDownUp className="size-4 opacity-70" />
							Sort by
							<SoonTag />
						</DropdownMenuItem>
						<DropdownMenuItem disabled>
							<Group className="size-4 opacity-70" />
							Group by
							<SoonTag />
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						{/* Plain row (not a menu item) so toggling never closes the menu. */}
						<div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
							<span>Show table</span>
							<Switch
								checked={!table.collapsed}
								onCheckedChange={table.onToggle}
								data-testid="customize-toggle-table"
								aria-label="Show table"
							/>
						</div>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
