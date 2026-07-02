import { CalendarRange } from "lucide-react";
import type { ReactNode } from "react";
import CustomizeMenu from "./customize-menu";

/**
 * Scheduler layout — placeholder scaffold. The Customize menu carries the view
 * switcher so the user can switch back. Build the real scheduler UI in place of
 * the empty body below.
 */
export default function SchedulerView({
	viewSwitch,
}: {
	viewSwitch?: ReactNode;
}) {
	return (
		<div className="relative flex h-full flex-col" data-testid="scheduler-view">
			{/* toolbar — matches the timeline toolbar shell */}
			<div className="flex items-center justify-between border-b border-border p-2">
				<div className="flex items-center gap-1.5" />
				<div className="flex items-center gap-1.5">
					<CustomizeMenu viewSwitch={viewSwitch} />
				</div>
			</div>
			{/* body */}
			<div className="flex flex-1 items-center justify-center text-muted-foreground">
				<div className="flex flex-col items-center gap-2">
					<CalendarRange className="size-8 opacity-40" />
					<p className="text-sm font-medium">Scheduler</p>
					<p className="text-xs">Coming soon</p>
				</div>
			</div>
		</div>
	);
}
