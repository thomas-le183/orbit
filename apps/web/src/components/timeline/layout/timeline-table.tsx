import { cn } from "@orbit/shared";
import { useMemo } from "react";
import { useTimelineController } from "../controller/context";
import { layoutItems } from "../controller/layout";
import { useTimelineItems } from "../use-timeline-items";
import { contentHeight, ROW_HEIGHT, ROW_PADDING, rowTop } from "./row-metrics";

/** Column titles for the header band, left of the date axis. */
export function TimelineTableHeader() {
	return (
		<div className="flex h-full items-center gap-2 px-3 text-xs font-semibold text-muted-foreground bg-background-primary">
			<span className="flex-1">Name</span>
			<span className="w-24 shrink-0">Assignee</span>
			<span className="w-28 shrink-0">Dates</span>
		</div>
	);
}

/** Left table column: one cell per timeline row, aligned to ItemsLayer rows. */
export default function TimelineTable() {
	const { today } = useTimelineController();
	const { items } = useTimelineItems();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);

	return (
		<div
			className="relative w-full"
			style={{ height: contentHeight(rows.length) }}
		>
			{rows.map((row) => {
				const top = rowTop(row.rowIndex);
				const { item } = row;
				return (
					<div
						key={item.id}
						data-testid="timeline-table-row"
						className="absolute inset-x-0 flex items-center gap-2 px-3 text-xs"
						style={{ top, height: ROW_HEIGHT - ROW_PADDING * 2 }}
					>
						<span
							className="flex min-w-0 flex-1 items-center gap-1.5"
							style={{ paddingLeft: row.depth * 14 }}
						>
							<span
								className="size-2 shrink-0 rounded-full"
								style={{ backgroundColor: item.color }}
							/>
							<span
								className={cn(
									"truncate",
									row.isParent
										? "font-semibold text-foreground"
										: "text-foreground",
								)}
							>
								{item.name}
							</span>
						</span>
						<span className="w-24 shrink-0 truncate text-muted-foreground">
							{item.assignee?.name ?? ""}
						</span>
						<span className="w-28 shrink-0 truncate text-muted-foreground">
							{item.startDate} → {item.endDate}
						</span>
					</div>
				);
			})}
		</div>
	);
}
