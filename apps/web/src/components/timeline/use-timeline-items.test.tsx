import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { useTimelineItems } from "./use-timeline-items";

const seed: TimelineItem[] = [
	{
		id: "p",
		kind: "task",
		name: "Parent",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-02",
		color: "#000",
	},
	{
		id: "c1",
		kind: "task",
		name: "C1",
		parentId: "p",
		startDate: "2026-06-03",
		endDate: "2026-06-05",
		color: "#111",
	},
	{
		id: "c2",
		kind: "task",
		name: "C2",
		parentId: "p",
		startDate: "2026-06-10",
		endDate: "2026-06-12",
		color: "#222",
	},
];

const find = (items: TimelineItem[], id: string) =>
	items.find((i) => i.id === id);

describe("useTimelineItems", () => {
	it("updateItem patches a single item", () => {
		const { result } = renderHook(() => useTimelineItems(seed));
		act(() => result.current.updateItem("c1", { endDate: "2026-06-07" }));
		expect(find(result.current.items, "c1")?.endDate).toBe("2026-06-07");
	});

	it("moveDays shifts a leaf's own dates", () => {
		const { result } = renderHook(() => useTimelineItems(seed));
		act(() => result.current.moveDays("c1", 2));
		expect(find(result.current.items, "c1")?.startDate).toBe("2026-06-05");
		expect(find(result.current.items, "c1")?.endDate).toBe("2026-06-07");
	});

	it("moveDays on a parent shifts all descendant leaves, not the parent row", () => {
		const { result } = renderHook(() => useTimelineItems(seed));
		act(() => result.current.moveDays("p", 1));
		expect(find(result.current.items, "c1")?.startDate).toBe("2026-06-04");
		expect(find(result.current.items, "c2")?.startDate).toBe("2026-06-11");
		// parent's stored dates are untouched (its span is derived elsewhere)
		expect(find(result.current.items, "p")?.startDate).toBe("2026-06-01");
	});
});
