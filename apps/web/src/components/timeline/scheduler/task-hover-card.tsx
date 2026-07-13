import { cn } from "@orbit/shared";
import { UserAvatar } from "@orbit/ui/custom/user-avatar";
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

/** Format a "YYYY-MM-DD" day as e.g. "Jun 3" (UTC, so no timezone drift). */
function formatDay(date: string): string {
	const ms = Date.parse(`${date}T00:00:00Z`);
	if (!Number.isFinite(ms)) return date;
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(ms);
}

/** One label-left / value-right detail row. */
function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-muted-foreground">{label}</span>
			<span className="min-w-0 truncate text-right font-medium">
				{children}
			</span>
		</div>
	);
}

/**
 * Rich detail card for a scheduler bar. Surfaces everything the bar can't fit
 * inline: full (untruncated) name, status, assignee, date span, and — mirroring
 * the height/band model — both the total estimate and its per-day effort.
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
				{isMilestone && (
					<Row label="Type">
						<span className="text-muted-foreground">Milestone</span>
					</Row>
				)}
				{status && (
					<Row label="Status">
						<span className="inline-flex items-center gap-1.5">
							<span className={cn("size-2 rounded-full", status.dot)} />
							{status.label}
						</span>
					</Row>
				)}
				{item.assignee && (
					<Row label="Assignee">
						<span className="inline-flex items-center gap-1.5">
							<UserAvatar
								size="sm"
								colorSeed={item.assignee.id}
								placeholder={item.assignee.name}
								avatarUrl={item.assignee.avatarUrl}
							/>
							<span className="truncate">{item.assignee.name}</span>
						</span>
					</Row>
				)}
				<Row label={isMilestone ? "Date" : "Dates"}>
					{isMilestone || days <= 1
						? formatDay(item.startDate)
						: `${formatDay(item.startDate)} → ${formatDay(item.endDate)} · ${days}d`}
				</Row>
				{!isMilestone && perDay != null && (
					<Row label="Estimate">
						{days > 1
							? `${formatWorkload(item.estimatedTime as number)} · ${formatWorkload(perDay)}/day`
							: formatWorkload(item.estimatedTime as number)}
					</Row>
				)}
				{!isMilestone && item.progress !== undefined && (
					<Row label="Progress">
						<span className="inline-flex items-center gap-1.5">
							<span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
								<span
									className="block h-full rounded-full bg-primary"
									style={{ width: `${item.progress}%` }}
								/>
							</span>
							{item.progress}%
						</span>
					</Row>
				)}
			</div>
		</div>
	);
}
