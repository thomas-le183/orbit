import { ToggleGroup, ToggleGroupItem } from "@orbit/ui/components/toggle-group";
import { useZoomLevel } from "./controller/hooks";
import type { ZoomLevel } from "./units/types";

const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
	{ value: "weeks", label: "Weeks" },
	{ value: "months", label: "Months" },
	{ value: "quarters", label: "Quarters" },
	{ value: "years", label: "Years" },
];

export default function ZoomControl() {
	const [zoomLevel, setZoomLevel] = useZoomLevel();

	return (
		<ToggleGroup
			value={[zoomLevel]}
			onValueChange={(groupValue: string[]) => {
				const next = groupValue[0] as ZoomLevel | undefined;
				// single-select: clicking the active item yields [] — ignore so zoom never clears
				if (next) setZoomLevel(next);
			}}
			variant="outline"
			size="sm"
		>
			{ZOOM_OPTIONS.map((option) => (
				<ToggleGroupItem key={option.value} value={option.value}>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
