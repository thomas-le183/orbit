import { cn } from "@orbit/shared";
import { Skeleton } from "@orbit/ui/components/skeleton";
import { ROW_HEIGHT } from "./layout/row-metrics";

const ROWS: Array<{ nameW: string; barOff: number; barW: number }> = [
	{ nameW: "w-36", barOff: 8, barW: 30 },
	{ nameW: "w-28", barOff: 24, barW: 45 },
	{ nameW: "w-40", barOff: 12, barW: 25 },
	{ nameW: "w-32", barOff: 38, barW: 35 },
	{ nameW: "w-24", barOff: 18, barW: 50 },
	{ nameW: "w-44", barOff: 5, barW: 28 },
	{ nameW: "w-36", barOff: 30, barW: 40 },
];

/** Full-view skeleton that mimics the split-layout while a project's data loads. */
export default function TimelineSkeleton() {
	return (
		<div className="h-full" aria-busy="true">
			<span className="sr-only">Loading tasks</span>
			<div className="flex h-full flex-col">
				{/* toolbar placeholder */}
				<div className="flex items-center gap-2 border-b border-border p-2">
					<Skeleton className="h-7 w-20 rounded-md" />
					<Skeleton className="h-7 w-14 rounded-md" />
					<Skeleton className="h-7 w-20 rounded-md" />
				</div>
				{/* header band placeholder */}
				<div className="flex h-12 shrink-0 items-center border-b border-border px-3">
					<Skeleton className="h-4 w-48 rounded" />
				</div>
				{/* rows */}
				<div className="flex-1 overflow-hidden">
					{ROWS.map((row, i) => (
						<div
							key={i}
							data-testid="timeline-skeleton-row"
							className="flex items-center border-b border-border/40"
							style={{ height: ROW_HEIGHT }}
						>
							{/* left: table column region (~220px) */}
							<div className="flex w-[220px] shrink-0 items-center gap-2 px-3">
								<Skeleton className="size-2.5 shrink-0 rounded-full" />
								<Skeleton className={cn("h-3.5 rounded", row.nameW)} />
							</div>
							{/* right: bar area */}
							<div className="relative flex-1">
								<Skeleton
									className="absolute h-5 rounded-md"
									style={{
										left: `${row.barOff}%`,
										width: `${row.barW}%`,
									}}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
