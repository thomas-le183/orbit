import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/workspace/settings/profile-settings";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/profile")({
	component: ProfileSettings,
});
