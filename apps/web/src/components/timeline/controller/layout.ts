// apps/web/src/components/timeline/controller/layout.ts
import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import type { RelativeTimeRangeOffset } from "../units/types";

export type RenderRow = {
	item: TimelineItem;
	depth: number;
	range: RelativeTimeRangeOffset;
	rowIndex: number;
	isParent: boolean;
};

export type ContainerRect = {
	parentId: string;
	range: RelativeTimeRangeOffset;
	rowStart: number;
	rowEnd: number;
};

/** Own dates of a leaf/milestone as a ms range (end date inclusive → +1 day). */
function ownRange(item: TimelineItem, today: number): RelativeTimeRangeOffset {
	return {
		from: startOfUtcDay(Date.parse(item.startDate)) - today,
		to: startOfUtcDay(Date.parse(item.endDate)) - today + ONE_DAY,
	};
}

export function layoutItems(
	items: TimelineItem[],
	today: number,
): { rows: RenderRow[]; containers: ContainerRect[] } {
	const childrenOf = new Map<string | null, TimelineItem[]>();
	for (const item of items) {
		const key = item.parentId;
		const list = childrenOf.get(key) ?? [];
		list.push(item);
		childrenOf.set(key, list);
	}

	const rows: RenderRow[] = [];
	const containers: ContainerRect[] = [];

	const walk = (item: TimelineItem, depth: number): RelativeTimeRangeOffset => {
		const children = childrenOf.get(item.id) ?? [];
		const isParent = item.kind === "task" && children.length > 0;
		const rowIndex = rows.length;
		// Reserve the row now so children get later indices.
		const row: RenderRow = {
			item,
			depth,
			rowIndex,
			isParent,
			range: ownRange(item, today),
		};
		rows.push(row);

		if (!isParent) return row.range;

		let from = Number.POSITIVE_INFINITY;
		let to = Number.NEGATIVE_INFINITY;
		for (const child of children) {
			const childRange = walk(child, depth + 1);
			from = Math.min(from, childRange.from);
			to = Math.max(to, childRange.to);
		}
		row.range = { from, to };
		containers.push({
			parentId: item.id,
			range: row.range,
			rowStart: rowIndex,
			rowEnd: rows.length - 1,
		});
		return row.range;
	};

	for (const root of childrenOf.get(null) ?? []) walk(root, 0);

	return { rows, containers };
}
