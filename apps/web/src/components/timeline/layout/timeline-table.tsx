import { Checkbox } from "@orbit/ui/components/checkbox";
import { cn } from "@orbit/shared";
import { useMemo } from "react";
import { useTimelineController } from "../controller/context";
import { layoutItems } from "../controller/layout";
import { useRowSelection } from "../selection/context";
import { useTimelineItems } from "../use-timeline-items";
import { contentHeight, ROW_HEIGHT, ROW_PADDING, rowTop } from "./row-metrics";

/** Ordered visible row ids — the shared order both panes select against. */
function useOrderedIds(): string[] {
	const { today } = useTimelineController();
	const { items } = useTimelineItems();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	return useMemo(() => rows.map((r) => r.item.id), [rows]);
}

/** Column titles + select-all checkbox for the header band. */
export function TimelineTableHeader() {
	const orderedIds = useOrderedIds();
	const { selectedIds, selectAll } = useRowSelection();
	const allSelected =
		orderedIds.length > 0 && orderedIds.every((id) => selectedIds.has(id));

	return (
		<div className="flex h-full items-center gap-2 bg-background-primary px-3 text-xs font-semibold text-muted-foreground">
			<Checkbox
				data-testid="timeline-select-all"
				aria-label="Select all rows"
				checked={allSelected}
				onCheckedChange={() => selectAll(orderedIds)}
			/>
			<span className="flex-1">Name</span>
			<span className="w-24 shrink-0">Assignee</span>
			<span className="w-28 shrink-0">Dates</span>
		</div>
	);
}

/** Left table column: one selectable cell per timeline row, aligned to ItemsLayer rows. */
export default function TimelineTable() {
	const { today } = useTimelineController();
	const { items } = useTimelineItems();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	const orderedIds = useMemo(() => rows.map((r) => r.item.id), [rows]);
	const { isSelected, hoveredId, selectOne, selectTo, toggle, setHovered } =
		useRowSelection();

	return (
		<div
			className="relative w-full"
			style={{ height: contentHeight(rows.length) }}
		>
			{rows.map((row) => {
				const top = rowTop(row.rowIndex);
				const { item } = row;
				const selected = isSelected(item.id);
				return (
					<div
						key={item.id}
						data-testid="timeline-table-row"
						data-selected={selected}
						onClick={(e) =>
							e.shiftKey ? selectTo(item.id, orderedIds) : selectOne(item.id)
						}
						onMouseEnter={() => setHovered(item.id)}
						onMouseLeave={() => setHovered(null)}
						className={cn(
							"absolute inset-x-0 flex cursor-pointer items-center gap-2 px-3 text-xs",
							selected
								? "bg-accent"
								: hoveredId === item.id
									? "bg-muted/50"
									: "",
						)}
						style={{ top, height: ROW_HEIGHT - ROW_PADDING * 2 }}
					>
						<Checkbox
							aria-label={`Select ${item.name}`}
							checked={selected}
							onCheckedChange={() => toggle(item.id)}
							onClick={(e) => e.stopPropagation()}
						/>
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
									"min-w-0 truncate",
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
