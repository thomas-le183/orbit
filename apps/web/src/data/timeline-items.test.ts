import { describe, expect, it } from "vitest";
import { type TimelineItem, timelineItems } from "./timeline-items";

const byId = new Map<string, TimelineItem>(timelineItems.map((i) => [i.id, i]));

describe("timelineItems seed", () => {
	it("has unique ids", () => {
		expect(byId.size).toBe(timelineItems.length);
	});

	it("every parentId resolves to an existing task", () => {
		for (const item of timelineItems) {
			if (item.parentId === null) continue;
			const parent = byId.get(item.parentId);
			expect(parent, `${item.id} parent`).toBeDefined();
			expect(parent?.kind).toBe("task");
		}
	});

	it("milestones are zero-duration (start === end)", () => {
		for (const item of timelineItems.filter((i) => i.kind === "milestone")) {
			expect(item.startDate).toBe(item.endDate);
		}
	});

	it("includes at least one parent task with children and one milestone", () => {
		const parentIds = new Set(
			timelineItems.map((i) => i.parentId).filter(Boolean),
		);
		expect(parentIds.size).toBeGreaterThan(0);
		expect(timelineItems.some((i) => i.kind === "milestone")).toBe(true);
	});
});
