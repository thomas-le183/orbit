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
				highlighted && "bg-primary/10",
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
