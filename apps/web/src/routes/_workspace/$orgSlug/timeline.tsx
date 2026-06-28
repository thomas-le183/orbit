import { createFileRoute } from "@tanstack/react-router";
import SplitLayout from "@/components/timeline/layout/split-layout";
import TimelineTable, {
	TimelineTableHeader,
} from "@/components/timeline/layout/timeline-table";

export const Route = createFileRoute("/_workspace/$orgSlug/timeline")({
	component: TimelinePage,
});

function TimelinePage() {
	return (
		<div className="h-full">
			<SplitLayout
				tableHeader={<TimelineTableHeader />}
				table={<TimelineTable />}
			/>
		</div>
	);
}
