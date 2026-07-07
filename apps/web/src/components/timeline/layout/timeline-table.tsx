import { cn } from "@orbit/shared";
import { Checkbox } from "@orbit/ui/components/checkbox";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@orbit/ui/components/tooltip";
import { TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { useTimelineController } from "../controller/context";
import { layoutItems } from "../controller/layout";
import { useTimelineData } from "../data/context";
import { DraftTableCell } from "../draft/draft-row";
import { useDraftTask } from "../draft/use-draft-task";
import { useRowSelection } from "../selection/context";
import { contentHeight, ROW_HEIGHT } from "./row-metrics";
import { useVirtualRows } from "./virtual-rows";

/** Ordered visible row ids — the shared order both panes select against. */
function useOrderedIds(): string[] {
	const { today } = useTimelineController();
	const { items, undatedTaskRows } = useTimelineData();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	return useMemo(
		() => [...rows.map((r) => r.item.id), ...undatedTaskRows.map((u) => u.id)],
		[rows, undatedTaskRows],
	);
}

/** Column titles + select-all checkbox for the header band. */
export function TimelineTableHeader() {
	const orderedIds = useOrderedIds();
	const { selectedIds, selectAll, clear } = useRowSelection();
	const allSelected =
		orderedIds.length > 0 && orderedIds.every((id) => selectedIds.has(id));
	const someSelected = selectedIds.size > 0;

	return (
		<div className="flex h-full items-center gap-2 bg-background-primary px-3 text-xs font-semibold text-muted-foreground">
			<Checkbox
				data-testid="timeline-select-all"
				aria-label={someSelected ? "Clear selection" : "Select all rows"}
				checked={allSelected}
				indeterminate={someSelected && !allSelected}
				// Any selection → clear all immediately; otherwise select everything.
				onClick={() => (someSelected ? clear() : selectAll(orderedIds))}
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
	const { items, undatedTaskRows } = useTimelineData();
	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	const orderedIds = useMemo(
		() => [...rows.map((r) => r.item.id), ...undatedTaskRows.map((u) => u.id)],
		[rows, undatedTaskRows],
	);
	const { isSelected, hoveredId, selectTo, toggle, setHovered } =
		useRowSelection();
	const { isVisible } = useVirtualRows();
	const { enabled: draftEnabled } = useDraftTask();

	const draftIndex = rows.length + undatedTaskRows.length;
	const totalRows = draftIndex + (draftEnabled ? 1 : 0);

	return (
		<div
			className="relative w-full"
			style={{ height: contentHeight(totalRows) }}
		>
			{rows.map((row) => {
				if (!isVisible(row.rowIndex)) return null;
				// Full-lane row so the table row height matches the timeline row band.
				const top = row.rowIndex * ROW_HEIGHT;
				const { item } = row;
				const selected = isSelected(item.id);
				return (
					<div
						key={item.id}
						data-testid="timeline-table-row"
						data-selected={selected}
						onMouseEnter={() => setHovered(item.id)}
						onMouseLeave={() => setHovered(null)}
						className={cn(
							"absolute inset-x-0 flex items-center gap-2 px-3 text-xs",
							selected
								? "bg-accent"
								: hoveredId === item.id
									? "bg-muted/50"
									: "",
						)}
						style={{ top, height: ROW_HEIGHT }}
					>
						<Checkbox
							aria-label={`Select ${item.name}`}
							checked={selected}
							// Selection happens only via the checkbox; shift-click extends a range.
							onClick={(e) => {
								e.stopPropagation();
								if (e.shiftKey) selectTo(item.id, orderedIds);
								else toggle(item.id);
							}}
						/>
						<span
							className="flex min-w-0 flex-1 items-center gap-1.5"
							style={{ paddingLeft: row.depth * 14 }}
						>
							{/* Reserved warning slot — kept empty so names align with warned rows. */}
							<span className="size-3.5 shrink-0" aria-hidden />
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

			{undatedTaskRows.map((task, i) => {
				if (!isVisible(rows.length + i)) return null;
				const top = (rows.length + i) * ROW_HEIGHT;
				const selected = isSelected(task.id);
				return (
					<div
						key={task.id}
						data-testid="timeline-table-row"
						data-selected={selected}
						onMouseEnter={() => setHovered(task.id)}
						onMouseLeave={() => setHovered(null)}
						className={cn(
							"absolute inset-x-0 flex items-center gap-2 px-3 text-xs",
							selected
								? "bg-accent"
								: hoveredId === task.id
									? "bg-muted/50"
									: "",
						)}
						style={{ top, height: ROW_HEIGHT }}
					>
						<Checkbox
							aria-label={`Select ${task.name}`}
							checked={selected}
							onClick={(e) => {
								e.stopPropagation();
								if (e.shiftKey) selectTo(task.id, orderedIds);
								else toggle(task.id);
							}}
						/>
						<span className="flex min-w-0 flex-1 items-center gap-1.5">
							{/* Warning slot — same width as the reserved slot on dated rows. */}
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger className="flex size-3.5 shrink-0 items-center justify-center">
										<TriangleAlert
											aria-label="Unplanned"
											className="size-3.5 text-amber-500"
										/>
									</TooltipTrigger>
									<TooltipContent>
										Unplanned — set a start or due date to schedule.
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<span className="size-2 shrink-0 rounded-full bg-muted-foreground/30" />
							<span className="min-w-0 truncate text-foreground">
								{task.name}
							</span>
						</span>
						<span className="w-24 shrink-0 truncate text-muted-foreground" />
						<span className="w-28 shrink-0 truncate text-muted-foreground">
							No dates
						</span>
					</div>
				);
			})}

			{draftEnabled && isVisible(draftIndex) && (
				<DraftTableCell rowIndex={draftIndex} />
			)}
		</div>
	);
}
