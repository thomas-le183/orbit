import type { ReactNode } from "react";
import { useTimelineData } from "../data/context";
import TimelineEmptyState from "../timeline-empty-state";
import TimelineSkeleton from "../timeline-skeleton";
import SchedulerLayout from "./scheduler-layout";

/**
 * Scheduler layout — one row per assignee, tasks packed into stacked sub-lanes.
 * The Customize menu carries the view switcher so the user can switch back.
 */
export default function SchedulerView({
	viewSwitch,
}: {
	viewSwitch?: ReactNode;
}) {
	const { projectId, items, undatedTaskRows, isLoading, isError } =
		useTimelineData();

	const isLoadingProject = !!projectId && isLoading;
	const isEmptyProject =
		!!projectId &&
		!isLoading &&
		!isError &&
		items.length === 0 &&
		undatedTaskRows.length === 0;

	if (isLoadingProject) return <TimelineSkeleton />;
	if (isEmptyProject) return <TimelineEmptyState projectId={projectId} />;

	return <SchedulerLayout viewSwitch={viewSwitch} />;
}
