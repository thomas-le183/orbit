import { useState } from "react";
import { CreateTaskDialog } from "./create-task-dialog";
import { useTimelineData } from "./data/context";
import SplitLayout from "./layout/split-layout";
import TimelineTable, { TimelineTableHeader } from "./layout/timeline-table";
import SchedulerView from "./scheduler/scheduler-view";
import TimelineEmptyState from "./timeline-empty-state";
import TimelineSkeleton from "./timeline-skeleton";
import { useViewMode } from "./use-view-mode";
import ViewModeToggle from "./view-mode-toggle";

export default function TimelineView() {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();
	const [newTaskOpen, setNewTaskOpen] = useState(false);
	const [viewMode, setViewMode] = useViewMode();

	const viewSwitch = <ViewModeToggle value={viewMode} onChange={setViewMode} />;

	if (viewMode === "scheduler") {
		return (
			<div className="h-full">
				<SchedulerView viewSwitch={viewSwitch} />
			</div>
		);
	}

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
						projectId={projectId}
						viewSwitch={viewSwitch}
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
