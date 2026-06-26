import { cn } from "@orbit/shared";

export function GridUnit({
	leftPercent,
	widthPercent,
	withRightBorder,
	isToday,
}: {
	leftPercent: number;
	widthPercent: number;
	withRightBorder: boolean;
	isToday: boolean;
}) {
	return (
		<div
			data-testid="timeline-grid-unit"
			data-today={isToday ? "true" : undefined}
			className={cn(
				"absolute top-0 h-full box-border",
				withRightBorder && "border-l border-border",
				isToday && "bg-muted/40",
			)}
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
		/>
	);
}
