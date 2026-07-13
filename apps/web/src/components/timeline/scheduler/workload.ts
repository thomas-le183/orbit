import type { TimelineItem } from "@/data/timeline-items";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import { isNonWorkingDay } from "../units/working-days";

/**
 * Default daily capacity — one standard 8h workday, applied uniformly to every
 * member. Non-working days (weekends) have zero capacity, so any effort
 * scheduled there reads as overloaded. This is the single knob until real
 * per-member capacity exists.
 */
export const DEFAULT_DAILY_CAPACITY_MINUTES = 480;

/**
 * Default daily task capacity — the number of concurrent tasks that fills the
 * band in "count" mode. A day with more tasks reads as overloaded. Fixed for
 * now, mirroring {@link DEFAULT_DAILY_CAPACITY_MINUTES}.
 */
export const DEFAULT_DAILY_TASK_CAPACITY = 5;

/** Which quantity the workload band visualizes. */
export type WorkloadMetric = "hours" | "count";

/** One calendar day's scheduled load for an assignee. */
export type DayLoad = {
	/** UTC start-of-day, in ms — aligns to the timeline's day grid. */
	dayMs: number;
	/** Effort scheduled on this day, in minutes (0 for unestimated tasks). */
	minutes: number;
	/** Number of tasks scheduled on this day, regardless of estimate. */
	count: number;
};

/**
 * Inclusive day span of a task's [startDate, endDate] range — a task ending on
 * its start day is 1 day, not 0. The shared definition of "how many days does
 * this task occupy", used both to spread a workload estimate and to convert
 * between a task's total estimate and its per-day effort. Returns 1 for missing
 * or inverted dates so callers never divide by zero.
 */
export function spanDays(startDate: string, endDate: string): number {
	const start = startOfUtcDay(Date.parse(startDate));
	const end = startOfUtcDay(Date.parse(endDate));
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
	return Math.round((end - start) / ONE_DAY) + 1;
}

/**
 * Per-day load for a set of tasks. Each task's `estimatedTime` is spread evenly
 * across its inclusive start→end day span (an 8h task over 4 days counts as
 * 2h/day) and summed per calendar day; the task also increments that day's
 * `count`. A task with no estimate contributes to `count` but adds no minutes.
 * Undated or inverted-date tasks are skipped entirely. Sorted by day ascending.
 */
export function dailyWorkload(tasks: TimelineItem[]): DayLoad[] {
	const byDay = new Map<number, { minutes: number; count: number }>();
	for (const task of tasks) {
		const start = startOfUtcDay(Date.parse(task.startDate));
		const end = startOfUtcDay(Date.parse(task.endDate));
		if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
			continue;
		}
		const dayCount = spanDays(task.startDate, task.endDate);
		const estimate =
			task.estimatedTime != null && task.estimatedTime > 0
				? task.estimatedTime
				: 0;
		const perDay = estimate / dayCount;
		for (let i = 0; i < dayCount; i++) {
			const dayMs = start + i * ONE_DAY;
			const entry = byDay.get(dayMs) ?? { minutes: 0, count: 0 };
			entry.minutes += perDay;
			entry.count += 1;
			byDay.set(dayMs, entry);
		}
	}
	return [...byDay.entries()]
		.map(([dayMs, { minutes, count }]) => ({ dayMs, minutes, count }))
		.sort((a, b) => a.dayMs - b.dayMs);
}

/**
 * Capacity (minutes) for the day containing `dayMs`: a full workday on working
 * days, zero on non-working days (weekends).
 */
export function dayCapacityMinutes(dayMs: number): number {
	return isNonWorkingDay(dayMs) ? 0 : DEFAULT_DAILY_CAPACITY_MINUTES;
}

/**
 * A day's effort as a fraction of that day's capacity. >1 means over capacity.
 * A non-working day has zero capacity, so any effort scheduled on it is over
 * capacity (Infinity); an empty non-working day is 0.
 */
export function capacityRatio(minutes: number, dayMs: number): number {
	const cap = dayCapacityMinutes(dayMs);
	if (cap <= 0) return minutes > 0 ? Number.POSITIVE_INFINITY : 0;
	return minutes / cap;
}

/**
 * Decimal-hour label for a workload amount, e.g. "0.25h" (15m), "1.5h", "8h".
 * Rounded to two decimals, with trailing zeros dropped by the number literal.
 */
export function formatWorkload(minutes: number): string {
	const hours = Math.round((minutes / 60) * 100) / 100;
	return `${hours}h`;
}

/**
 * A day's task count as a fraction of the fixed daily task capacity. >1 means
 * more concurrent tasks than the capacity, i.e. over capacity.
 */
export function taskCountRatio(count: number): number {
	return count / DEFAULT_DAILY_TASK_CAPACITY;
}

/** Task-count label for a day, e.g. "1 task", "3 tasks". */
export function formatTaskCount(count: number): string {
	return `${count} ${count === 1 ? "task" : "tasks"}`;
}

/**
 * Combined label for a day's load, showing both metrics regardless of the
 * active band mode, e.g. "1.5h · 3 tasks". Lets a tooltip report hours and task
 * count together so the reading isn't tied to the current mode.
 */
export function formatDayLoad(load: DayLoad): string {
	return `${formatWorkload(load.minutes)} · ${formatTaskCount(load.count)}`;
}
