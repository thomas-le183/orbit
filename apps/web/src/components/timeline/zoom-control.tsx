import { Button } from "@orbit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useZoomLevel } from "./controller/hooks";
import type { ZoomLevel } from "./units/types";

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
	{ value: "weeks", label: "Weeks" },
	{ value: "months", label: "Months" },
	{ value: "quarters", label: "Quarters" },
	{ value: "years", label: "Years" },
];

export default function ZoomControl({
	levels,
}: {
	/** Restrict the offered zoom levels (order preserved). Defaults to all. */
	levels?: ZoomLevel[];
} = {}) {
	const [zoomLevel, setZoomLevel] = useZoomLevel();
	const options = levels
		? ZOOM_OPTIONS.filter((o) => levels.includes(o.value))
		: ZOOM_OPTIONS;
	const currentLabel =
		options.find((o) => o.value === zoomLevel)?.label ?? "View";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="outline" size="sm" className="gap-1.5" />}
			>
				{currentLabel}
				<ChevronDown className="size-4 opacity-60" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-32">
				<DropdownMenuRadioGroup
					value={zoomLevel}
					onValueChange={(value) => setZoomLevel(value as ZoomLevel)}
				>
					{options.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
