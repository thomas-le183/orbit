import { cn } from "@orbit/shared";
import { CalendarRange, GanttChartSquare } from "lucide-react";
import type { ViewMode } from "./use-view-mode";

const OPTIONS: {
	value: ViewMode;
	label: string;
	icon: typeof GanttChartSquare;
}[] = [
	{ value: "timeline", label: "Timeline", icon: GanttChartSquare },
	{ value: "scheduler", label: "Scheduler", icon: CalendarRange },
];

/** Segmented control that switches the project view between layouts. */
export default function ViewModeToggle({
	value,
	onChange,
}: {
	value: ViewMode;
	onChange: (mode: ViewMode) => void;
}) {
	return (
		<div
			role="group"
			aria-label="Switch layout"
			className="flex w-full items-center justify-between gap-0.5 rounded-md border border-border p-0.5"
		>
			{OPTIONS.map(({ value: v, label, icon: Icon }) => {
				const active = v === value;
				return (
					<button
						key={v}
						type="button"
						data-testid={`view-mode-${v}`}
						aria-pressed={active}
						onClick={() => onChange(v)}
						className={cn(
							"flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
							active
								? "bg-muted text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="size-3.5" />
						{label}
					</button>
				);
			})}
		</div>
	);
}
