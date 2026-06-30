import { createFileRoute } from "@tanstack/react-router";
import TimelineView from "@/components/timeline/timeline-view";

export const Route = createFileRoute(
	"/_workspace/$orgSlug/projects/$projectId",
)({
	component: TimelineView,
});
