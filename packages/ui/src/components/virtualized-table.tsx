"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "@orbit/ui/components/table";
import { cn } from "@orbit/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	cloneElement,
	Fragment,
	isValidElement,
	type ReactNode,
	useRef,
} from "react";

type VirtualizedTableProps<T> = {
	/** All rows; only those inside the scroll window are mounted. */
	rows: T[];
	/** Stable React key for a row. */
	rowKey: (row: T, index: number) => string;
	/** Render a full `<TableRow>` (with its cells) for a row. */
	renderRow: (row: T, index: number) => ReactNode;
	/** Optional `<TableHeader>`; make its cells sticky for a pinned header. */
	header?: ReactNode;
	/** Estimated row height in px; rows are then measured for exact windowing. */
	rowHeight?: number;
	/** Extra rows rendered above/below the window to smooth fast scrolls. */
	overscan?: number;
	/** Column count so the spacer rows span the full table width. */
	columnCount: number;
	/** Caps the scroll region; shorter lists render with no inner scrollbar. */
	maxHeight?: number | string;
	/** Classes for the scroll container. */
	className?: string;
};

/**
 * Windowed semantic table: keeps native `<table>` column sizing by spacing the
 * off-screen rows with a single top/bottom padding row instead of absolutely
 * positioning each row. Only the visible slice (plus overscan) is mounted, so a
 * table of thousands of rows stays cheap. Rendered rows are measured after
 * mount so variable row heights keep the spacers exact. Lists shorter than
 * `maxHeight` render like a plain table — no inner scrollbar until they overflow.
 */
export function VirtualizedTable<T>({
	rows,
	rowKey,
	renderRow,
	header,
	rowHeight = 44,
	overscan = 8,
	columnCount,
	maxHeight,
	className,
}: VirtualizedTableProps<T>) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => rowHeight,
		overscan,
	});

	const virtualItems = virtualizer.getVirtualItems();
	// Unmeasured viewport (initial mount, jsdom) → render every row.
	const measured =
		virtualItems.length > 0 && (scrollRef.current?.clientHeight ?? 0) > 0;

	const paddingTop = measured ? virtualItems[0].start : 0;
	const paddingBottom = measured
		? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
		: 0;

	const rendered = measured
		? virtualItems.map((vi) => ({ row: rows[vi.index], index: vi.index }))
		: rows.map((row, index) => ({ row, index }));

	return (
		<div
			ref={scrollRef}
			data-slot="virtualized-table"
			className={cn("relative w-full overflow-y-auto", className)}
			style={{ maxHeight }}
		>
			<Table>
				{header}
				<TableBody>
					{paddingTop > 0 && (
						<TableRow
							aria-hidden
							className="border-0 hover:bg-transparent"
							data-testid="virtualized-table-spacer-top"
						>
							<TableCell colSpan={columnCount} style={{ height: paddingTop }} />
						</TableRow>
					)}
					{rendered.map(({ row, index }) => {
						const el = renderRow(row, index);
						const key = rowKey(row, index);
						// Attach the measuring ref + index onto the consumer's <TableRow>
						// so variable heights are measured and the spacers stay exact.
						if (measured && isValidElement(el)) {
							return cloneElement(
								el as React.ReactElement<Record<string, unknown>>,
								{
									key,
									ref: virtualizer.measureElement,
									"data-index": index,
								},
							);
						}
						return <Fragment key={key}>{el}</Fragment>;
					})}
					{paddingBottom > 0 && (
						<TableRow
							aria-hidden
							className="border-0 hover:bg-transparent"
							data-testid="virtualized-table-spacer-bottom"
						>
							<TableCell
								colSpan={columnCount}
								style={{ height: paddingBottom }}
							/>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
