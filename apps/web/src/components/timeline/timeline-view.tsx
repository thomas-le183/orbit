import { useState } from "react";
import { CreateTaskDialog } from "./create-task-dialog";
import { useTimelineData } from "./data/context";
import SplitLayout from "./layout/split-layout";
import TimelineTable, { TimelineTableHeader } from "./layout/timeline-table";
import TimelineEmptyState from "./timeline-empty-state";
import TimelineSkeleton from "./timeline-skeleton";

export default function TimelineView() {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();
	const [newTaskOpen, setNewTaskOpen] = useState(false);

	const isLoadingProject = !!projectId && isLoading;
	const isEmptyProject =
		!!projectId &&
		!isLoading &&
		!isError &&
		items.length === 0 &&
		undatedTaskRows.length === 0;

	return (
		<div className="h-full">
			{isLoadingProject ? (
				<TimelineSkeleton />
			) : isEmptyProject ? (
				<TimelineEmptyState projectId={projectId} />
			) : (
				<>
					<SplitLayout
						tableHeader={<TimelineTableHeader />}
						table={<TimelineTable />}
						onNewTask={projectId ? () => setNewTaskOpen(true) : undefined}
					/>
					{projectId && (
						<CreateTaskDialog
							projectId={projectId}
							open={newTaskOpen}
							onOpenChange={setNewTaskOpen}
						/>
					)}
				</>
			)}
		</div>
	);
}
