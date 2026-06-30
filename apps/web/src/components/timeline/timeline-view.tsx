import { useTimelineData } from "./data/context";
import SplitLayout from "./layout/split-layout";
import TimelineTable, { TimelineTableHeader } from "./layout/timeline-table";
import TimelineEmptyState from "./timeline-empty-state";

export default function TimelineView() {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();
	const isEmptyProject =
		!!projectId &&
		!isLoading &&
		!isError &&
		items.length === 0 &&
		undatedTaskRows.length === 0;

	return (
		<div className="h-full">
			{isEmptyProject ? (
				<TimelineEmptyState projectId={projectId} />
			) : (
				<SplitLayout
					tableHeader={<TimelineTableHeader />}
					table={<TimelineTable />}
				/>
			)}
		</div>
	);
}
