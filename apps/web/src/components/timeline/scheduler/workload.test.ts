import { describe, expect, it } from "vitest";
import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import {
	capacityRatio,
	DEFAULT_DAILY_CAPACITY_MINUTES,
	DEFAULT_DAILY_TASK_CAPACITY,
	dailyWorkload,
	formatDayLoad,
	formatTaskCount,
	formatWorkload,
	taskCountRatio,
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

	it("counts tasks with no or non-positive estimate but adds no minutes", () => {
		const load = dailyWorkload([
			task({ estimatedTime: undefined }),
			task({ id: "z", estimatedTime: 0 }),
		]);
		// Both tasks are dated on 2026-06-01, so that day has 2 tasks and 0 minutes.
		expect(load).toHaveLength(1);
		expect(load[0].minutes).toBe(0);
		expect(load[0].count).toBe(2);
	});

	it("skips undated and inverted-date tasks entirely", () => {
		expect(
			dailyWorkload([
				task({ startDate: "", endDate: "", estimatedTime: 60 }),
				task({
					id: "z",
					startDate: "2026-06-04",
					endDate: "2026-06-01",
					estimatedTime: 60,
				}),
			]),
		).toEqual([]);
	});

	it("counts each task once per day it spans", () => {
		const load = dailyWorkload([
			task({
				startDate: "2026-06-01",
				endDate: "2026-06-02",
				estimatedTime: 60,
			}),
			task({ id: "b", startDate: "2026-06-02", endDate: "2026-06-02" }),
		]);
		// day 1: task a only; day 2: tasks a + b.
		expect(load.map((d) => d.count)).toEqual([1, 2]);
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

describe("taskCountRatio", () => {
	it("measures a day's task count against the fixed task capacity", () => {
		expect(taskCountRatio(0)).toBe(0);
		expect(taskCountRatio(DEFAULT_DAILY_TASK_CAPACITY)).toBe(1);
		// One more task than capacity is over capacity.
		expect(taskCountRatio(DEFAULT_DAILY_TASK_CAPACITY + 1)).toBeGreaterThan(1);
	});
});

describe("formatTaskCount", () => {
	it("pluralizes the task label", () => {
		expect(formatTaskCount(0)).toBe("0 tasks");
		expect(formatTaskCount(1)).toBe("1 task");
		expect(formatTaskCount(3)).toBe("3 tasks");
	});
});

describe("formatDayLoad", () => {
	it("reports both hours and task count in one label", () => {
		expect(formatDayLoad({ dayMs: 0, minutes: 90, count: 3 })).toBe(
			"1.5h · 3 tasks",
		);
	});

	it("still reports the task count when there are no estimated hours", () => {
		expect(formatDayLoad({ dayMs: 0, minutes: 0, count: 1 })).toBe(
			"0h · 1 task",
		);
	});
});
