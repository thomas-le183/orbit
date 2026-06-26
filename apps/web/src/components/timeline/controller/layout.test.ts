// apps/web/src/components/timeline/controller/layout.test.ts
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { startOfUtcDay } from "../units/make-units";
import { layoutItems } from "./layout";

const ONE_DAY = 86_400_000;
const today = startOfUtcDay(Date.parse("2026-06-01"));
const dayOffset = (iso: string) => startOfUtcDay(Date.parse(iso)) - today;

const items: TimelineItem[] = [
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
		name: "Child 1",
		parentId: "p",
		startDate: "2026-06-03",
		endDate: "2026-06-05",
		color: "#111",
	},
	{
		id: "c2",
		kind: "task",
		name: "Child 2",
		parentId: "p",
		startDate: "2026-06-10",
		endDate: "2026-06-12",
		color: "#222",
	},
	{
		id: "m",
		kind: "milestone",
		name: "Mile",
		parentId: null,
		startDate: "2026-06-20",
		endDate: "2026-06-20",
		color: "#333",
	},
];

describe("layoutItems", () => {
	it("assigns sequential rowIndex in document (depth-first) order", () => {
		const { rows } = layoutItems(items, today);
		expect(rows.map((r) => r.item.id)).toEqual(["p", "c1", "c2", "m"]);
		expect(rows.map((r) => r.rowIndex)).toEqual([0, 1, 2, 3]);
		expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0]);
	});

	it("derives a parent's range from its children (rollup), ignoring its own dates", () => {
		const { rows } = layoutItems(items, today);
		const parent = rows.find((r) => r.item.id === "p");
		expect(parent?.isParent).toBe(true);
		// min child start (c1 = Jun 3) .. max child end (c2 = Jun 12, inclusive → +1 day)
		expect(parent?.range.from).toBe(dayOffset("2026-06-03"));
		expect(parent?.range.to).toBe(dayOffset("2026-06-12") + ONE_DAY);
	});

	it("gives a milestone a one-day hit range starting at its date", () => {
		const { rows } = layoutItems(items, today);
		const mile = rows.find((r) => r.item.id === "m");
		expect(mile?.range.from).toBe(dayOffset("2026-06-20"));
		expect(mile?.range.to).toBe(dayOffset("2026-06-20") + ONE_DAY);
		expect(mile?.isParent).toBe(false);
	});

	it("emits a container rect spanning the parent's derived range and its rows", () => {
		const { containers } = layoutItems(items, today);
		expect(containers).toHaveLength(1);
		const c = containers[0];
		expect(c.parentId).toBe("p");
		expect(c.rowStart).toBe(0); // parent row
		expect(c.rowEnd).toBe(2); // last descendant row (c2)
		expect(c.range.from).toBe(dayOffset("2026-06-03"));
		expect(c.range.to).toBe(dayOffset("2026-06-12") + ONE_DAY);
	});

	it("treats a childless task as a leaf using its own dates", () => {
		const { rows, containers } = layoutItems(
			[
				{
					id: "solo",
					kind: "task",
					name: "Solo",
					parentId: null,
					startDate: "2026-06-04",
					endDate: "2026-06-06",
					color: "#000",
				},
			],
			today,
		);
		expect(rows[0].isParent).toBe(false);
		expect(rows[0].range.from).toBe(dayOffset("2026-06-04"));
		expect(rows[0].range.to).toBe(dayOffset("2026-06-06") + ONE_DAY);
		expect(containers).toHaveLength(0);
	});

	it("returns empty rows/containers for empty input", () => {
		expect(layoutItems([], today)).toEqual({ rows: [], containers: [] });
	});
});
