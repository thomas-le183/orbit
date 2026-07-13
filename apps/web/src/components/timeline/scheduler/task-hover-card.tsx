import { cn } from "@orbit/shared";
import { UserAvatar } from "@orbit/ui/custom/user-avatar";
import { CalendarDays, Clock, Flag, Gauge } from "lucide-react";
import type { TaskStatus, TimelineItem } from "@/data/timeline-items";
import { formatWorkload, spanDays } from "./workload";

/** Human label + dot color for each task status. */
const STATUS_META: Record<TaskStatus, { label: string; dot: string }> = {
	todo: { label: "To do", dot: "bg-muted-foreground" },
	in_progress: { label: "In progress", dot: "bg-blue-500" },
	in_review: { label: "In review", dot: "bg-amber-500" },
	done: { label: "Done", dot: "bg-emerald-500" },
	blocked: { label: "Blocked", dot: "bg-destructive" },
};

function parseDay(date: string): number {
	return Date.parse(`${date}T00:00:00Z`);
}

/** "Jun 3" — month + day, no year (UTC, so no timezone drift). */
function monthDay(ms: number): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(ms);
}

/** Year of a UTC day. */
function year(ms: number): number {
	return new Date(ms).getUTCFullYear();
}

/**
 * Compact date span. A single day reads "Jun 3, 2026"; a same-year span folds
 * the year to the end ("Jun 1 → Jun 4, 2026"); a cross-year span carries the
 * year on both ends. Multi-day spans append the inclusive day count.
 */
function formatDateRange(startDate: string, endDate: string): string {
	const start = parseDay(startDate);
	const end = parseDay(endDate);
	if (!Number.isFinite(start)) return startDate;
	if (!Number.isFinite(end) || end <= start) {
		return `${monthDay(start)}, ${year(start)}`;
	}
	const days = spanDays(startDate, endDate);
	const range =
		year(start) === year(end)
			? `${monthDay(start)} → ${monthDay(end)}, ${year(end)}`
			: `${monthDay(start)}, ${year(start)} → ${monthDay(end)}, ${year(end)}`;
	return `${range} · ${days}d`;
}

/**
 * One detail line: a 16px leading slot (icon or visual cue) + a self-describing
 * value. No text label — the cue and value carry the meaning.
 */
function Line({
	cue,
	children,
}: {
	cue: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-3.5">
				{cue}
			</span>
			<span className="min-w-0 truncate">{children}</span>
		</div>
	);
}

/**
 * Rich detail card for a scheduler bar. Surfaces everything the bar can't fit
 * inline: full (untruncated) name, status, assignee, date span, and — mirroring
 * the height/band model — both the total estimate and its per-day effort. Rows
 * carry no text labels; each value is self-describing via a leading cue.
 * Milestones drop the effort/progress rows and show their single date.
 */
export default function TaskHoverCard({ item }: { item: TimelineItem }) {
	const isMilestone = item.kind === "milestone";
	const days = spanDays(item.startDate, item.endDate);
	const status = item.status ? STATUS_META[item.status] : null;
	const perDay =
		item.estimatedTime != null && item.estimatedTime > 0
			? item.estimatedTime / days
			: null;

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-start gap-2">
				<span
					className="mt-1 size-2.5 shrink-0 rounded-full"
					style={{ backgroundColor: item.color }}
				/>
				<span className="font-medium leading-snug">{item.name}</span>
			</div>

			<div className="flex flex-col gap-1.5 text-xs">
				{isMilestone && <Line cue={<Flag />}>Milestone</Line>}
				{status && (
					<Line
						cue={<span className={cn("size-2 rounded-full", status.dot)} />}
					>
						{status.label}
					</Line>
				)}
				{item.assignee && (
					<Line
						cue={
							<UserAvatar
								size="default"
								className="size-4"
								colorSeed={item.assignee.id}
								placeholder={item.assignee.name}
								avatarUrl={item.assignee.avatarUrl}
							/>
						}
					>
						{item.assignee.name}
					</Line>
				)}
				<Line cue={<CalendarDays />}>
					{formatDateRange(item.startDate, item.endDate)}
				</Line>
				{!isMilestone && perDay != null && (
					<Line cue={<Clock />}>
						{days > 1
							? `${formatWorkload(item.estimatedTime as number)} · ${formatWorkload(perDay)}/day`
							: formatWorkload(item.estimatedTime as number)}
					</Line>
				)}
				{!isMilestone && item.progress !== undefined && (
					<Line cue={<Gauge />}>
						<span className="inline-flex items-center gap-2">
							<span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
								<span
									className="block h-full rounded-full bg-primary"
									style={{ width: `${item.progress}%` }}
								/>
							</span>
							{item.progress}%
						</span>
					</Line>
				)}
			</div>
		</div>
	);
}
