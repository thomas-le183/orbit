import { createFileRoute } from "@tanstack/react-router";
import { TimelineDataProvider } from "@/components/timeline/data/context";
import TimelineView from "@/components/timeline/timeline-view";

export const Route = createFileRoute(
	"/_workspace/$orgSlug/projects/$projectId",
)({
	component: ProjectTimelinePage,
});

function ProjectTimelinePage() {
	const { projectId } = Route.useParams();
	return (
		<TimelineDataProvider projectId={projectId}>
			<TimelineView />
		</TimelineDataProvider>
	);
}
