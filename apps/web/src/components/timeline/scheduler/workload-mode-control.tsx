import { Button } from "@orbit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import { BarChart2, ChevronDown } from "lucide-react";
import type { WorkloadMetric } from "./workload";

const OPTIONS: { value: WorkloadMetric; trigger: string; label: string }[] = [
	{ value: "hours", trigger: "Hours", label: "Work hours" },
	{ value: "count", trigger: "Tasks", label: "Task count" },
];

/**
 * Toolbar dropdown selecting what the per-assignee workload band visualizes —
 * scheduled hours vs. the daily hour capacity, or task count vs. a fixed task
 * capacity. Controlled so the scheduler owns the mode and can pass it to the
 * band.
 */
export default function WorkloadModeControl({
	value,
	onChange,
}: {
	value: WorkloadMetric;
	onChange: (value: WorkloadMetric) => void;
}) {
	const currentTrigger =
		OPTIONS.find((o) => o.value === value)?.trigger ?? "Hours";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="outline" size="sm" className="gap-1.5" />}
				aria-label="Workload display"
				title="Workload display"
			>
				<BarChart2 className="size-4 opacity-60" />
				{currentTrigger}
				<ChevronDown className="size-4 opacity-60" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-36">
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(v) => onChange(v as WorkloadMetric)}
				>
					{OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
