import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import {
	capacityRatio,
	DEFAULT_DAILY_CAPACITY_MINUTES,
	dailyWorkload,
	formatWorkload,
} from "./workload";

function task(partial: Partial<TimelineItem>): TimelineItem {
	return {
		id: "t",
		kind: "task",
		name: "T",
		parentId: null,
		startDate: "2026-06-01",
		endDate: "2026-06-01",
		color: "#000",
		...partial,
	};
}

const day = (iso: string) => startOfUtcDay(Date.parse(iso));

describe("dailyWorkload", () => {
	it("spreads a task's estimate evenly across its inclusive day span", () => {
		const load = dailyWorkload([
			task({
				startDate: "2026-06-01",
				endDate: "2026-06-04",
				estimatedTime: 480,
			}),
		]);
		// 480min over 4 inclusive days → 120min/day on each of the 4 days.
		expect(load).toHaveLength(4);
		for (const d of load) expect(d.minutes).toBe(120);
		expect(load[0].dayMs).toBe(day("2026-06-01"));
		expect(load[3].dayMs).toBe(day("2026-06-04"));
	});

	it("sums overlapping tasks per day and sorts ascending", () => {
		const load = dailyWorkload([
			task({
				id: "a",
				startDate: "2026-06-02",
				endDate: "2026-06-02",
				estimatedTime: 60,
			}),
			task({
				id: "b",
				startDate: "2026-06-01",
				endDate: "2026-06-02",
				estimatedTime: 120,
			}),
		]);
		// day 1: 60 (b half); day 2: 60 (a) + 60 (b half) = 120.
		expect(load.map((d) => d.dayMs)).toEqual([
			day("2026-06-01"),
			day("2026-06-02"),
		]);
		expect(load[0].minutes).toBe(60);
		expect(load[1].minutes).toBe(120);
	});

	it("ignores tasks with no or non-positive estimate", () => {
		expect(
			dailyWorkload([
				task({ estimatedTime: undefined }),
				task({ id: "z", estimatedTime: 0 }),
			]),
		).toEqual([]);
	});

	it("keeps day keys on the UTC day grid", () => {
		const [{ dayMs }] = dailyWorkload([task({ estimatedTime: 30 })]);
		expect(dayMs % ONE_DAY).toBe(0);
	});
});

describe("capacityRatio", () => {
	const monday = day("2026-06-01"); // working day
	const saturday = day("2026-06-06"); // weekend

	it("measures a working day's effort against the 8h default", () => {
		expect(capacityRatio(240, monday)).toBe(0.5);
		expect(capacityRatio(DEFAULT_DAILY_CAPACITY_MINUTES, monday)).toBe(1);
		expect(capacityRatio(600, monday)).toBe(1.25); // over capacity
	});

	it("treats any effort on a non-working day as over capacity", () => {
		expect(capacityRatio(60, saturday)).toBe(Number.POSITIVE_INFINITY);
		// An empty weekend day is not overloaded.
		expect(capacityRatio(0, saturday)).toBe(0);
	});
});

describe("formatWorkload", () => {
	it("formats amounts as decimal hours", () => {
		expect(formatWorkload(15)).toBe("0.25h");
		expect(formatWorkload(90)).toBe("1.5h");
		expect(formatWorkload(120)).toBe("2h");
		expect(formatWorkload(210)).toBe("3.5h");
		expect(formatWorkload(480)).toBe("8h");
	});
});
