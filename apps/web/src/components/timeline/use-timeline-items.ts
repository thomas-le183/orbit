import { useCallback, useState } from "react";
import { type TimelineItem, timelineItems } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "./units/make-units";

/** Shift an item's own start/end dates by a whole-day delta. */
function shiftDates(item: TimelineItem, days: number): TimelineItem {
	const move = (iso: string) =>
		toUtcDateString(startOfUtcDay(Date.parse(iso)) + days * ONE_DAY);
	return {
		...item,
		startDate: move(item.startDate),
		endDate: move(item.endDate),
	};
}

export function useTimelineItems(seed: TimelineItem[] = timelineItems): {
	items: TimelineItem[];
	updateItem: (id: string, patch: Partial<TimelineItem>) => void;
	moveDays: (id: string, days: number) => void;
} {
	const [items, setItems] = useState<TimelineItem[]>(seed);

	const updateItem = useCallback((id: string, patch: Partial<TimelineItem>) => {
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
	}, []);

	const moveDays = useCallback((id: string, days: number) => {
		if (days === 0) return;
		setItems((prev) => {
			const hasChildren = prev.some((i) => i.parentId === id);
			if (!hasChildren) {
				return prev.map((i) => (i.id === id ? shiftDates(i, days) : i));
			}
			// Parent: shift all descendants (transitively).
			const descendants = new Set<string>();
			let added = true;
			while (added) {
				added = false;
				for (const i of prev) {
					if (
						i.parentId &&
						(i.parentId === id || descendants.has(i.parentId)) &&
						!descendants.has(i.id)
					) {
						descendants.add(i.id);
						added = true;
					}
				}
			}
			return prev.map((i) =>
				descendants.has(i.id) && !prev.some((c) => c.parentId === i.id)
					? shiftDates(i, days)
					: i,
			);
		});
	}, []);

	return { items, updateItem, moveDays };
}
