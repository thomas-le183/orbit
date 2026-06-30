import { createFileRoute } from "@tanstack/react-router";
import { TimelineDataProvider } from "@/components/timeline/data/context";
import TimelineView from "@/components/timeline/timeline-view";

export const Route = createFileRoute("/_workspace/$orgSlug/timeline")({
	component: TimelinePage,
});

function TimelinePage() {
	return (
		<TimelineDataProvider>
			<TimelineView />
		</TimelineDataProvider>
	);
}
