/**
 * Date label that follows the cursor during a bar drag/resize. Rendered `fixed`
 * in viewport coordinates, so callers pass the raw pointer position and don't
 * need to map it into any scroll container.
 */
export default function DragTooltip({
	x,
	y,
	label,
}: {
	x: number;
	y: number;
	label: string;
}) {
	return (
		<div
			data-testid="timeline-drag-tooltip"
			className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium text-background shadow-md"
			style={{ left: x, top: y - 12 }}
		>
			{label}
		</div>
	);
}
