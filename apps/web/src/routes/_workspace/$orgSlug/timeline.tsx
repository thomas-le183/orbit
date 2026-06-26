import { createFileRoute } from "@tanstack/react-router";
import TimelineContainer from "@/components/timeline/container";

export const Route = createFileRoute("/_workspace/$orgSlug/timeline")({
	component: TimelinePage,
});

function TimelinePage() {
	return (
		<div className="h-full">
			<TimelineContainer />
		</div>
	);
}
