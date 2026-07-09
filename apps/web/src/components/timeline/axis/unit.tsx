import { cn } from "@orbit/shared";

export function GridUnit({
	leftPercent,
	widthPercent,
	withRightBorder,
}: {
	leftPercent: number;
	widthPercent: number;
	withRightBorder: boolean;
}) {
	return (
		<div
			data-testid="timeline-grid-unit"
			className={cn(
				"absolute top-0 h-full box-border",
				withRightBorder && "border-l border-border",
			)}
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
		/>
	);
}

/** Diagonal-hatch shading that marks a non-working (weekend) day column. */
export function NonWorkingStripe({
	leftPercent,
	widthPercent,
}: {
	leftPercent: number;
	widthPercent: number;
}) {
	return (
		<div
			data-testid="timeline-nonworking-stripe"
			className="absolute top-0 h-full"
			style={{
				left: `${leftPercent}%`,
				width: `${widthPercent}%`,
				backgroundImage:
					"repeating-linear-gradient(315deg, var(--color-foreground-light) 0, var(--color-foreground-light) 1px, transparent 0, transparent 50%)",
				opacity: 0.28,
				backgroundSize: "8px 8px",
			}}
		/>
	);
}
