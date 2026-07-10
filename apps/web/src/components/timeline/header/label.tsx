import { cn } from "@orbit/shared";
import type { ReactNode } from "react";

export function TopLabel({
	leftPercent,
	children,
}: {
	leftPercent: number;
	children: ReactNode;
}) {
	return (
		<div
			className="absolute top-0 h-full whitespace-nowrap px-2 text-xs font-semibold leading-6 text-muted-foreground"
			style={{ left: `${leftPercent}%` }}
		>
			{children}
		</div>
	);
}

export function BottomCell({
	leftPercent,
	widthPercent,
	children,
	withLeftBorder = false,
	highlighted = false,
}: {
	leftPercent: number;
	widthPercent: number;
	children: ReactNode;
	withLeftBorder?: boolean;
	highlighted?: boolean;
}) {
	return (
		<div
			data-testid="timeline-header-cell"
			data-highlighted={highlighted || undefined}
			className={cn(
				"absolute top-0 h-full overflow-hidden",
				highlighted && "bg-primary/25",
			)}
			style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
		>
			<div
				className={cn(
					"box-border h-full whitespace-nowrap text-center text-xs leading-6 text-muted-foreground",
					withLeftBorder && "border-l border-border",
					highlighted && "font-medium text-foreground",
				)}
			>
				{children}
			</div>
		</div>
	);
}

/**
 * Drag feedback for coarse zooms (quarters/years) where tinting a whole cell is
 * too imprecise. Instead of a background fill it pins a date-range label to the
 * axis right above the cursor.
 */
export function DragAxisLabel({
	centerPercent,
	label,
}: {
	/** Horizontal anchor of the label (cursor position), in axis percent. */
	centerPercent: number;
	label: string;
}) {
	const center = Math.min(100, Math.max(0, centerPercent));
	return (
		<div
			data-testid="timeline-drag-axis-label"
			data-highlighted
			className="pointer-events-none absolute inset-0 z-10"
		>
			{/* date-range label pinned above the cursor, on the bottom (fine) row */}
			<div
				className="absolute top-3/4 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
				style={{ left: `${center}%` }}
			>
				{label}
			</div>
		</div>
	);
}
