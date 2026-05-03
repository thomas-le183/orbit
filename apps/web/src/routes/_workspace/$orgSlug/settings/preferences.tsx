import { createFileRoute } from "@tanstack/react-router";
import { PreferencesSettings } from "@/components/workspace/settings/preferences-settings";

export const Route = createFileRoute(
	"/_workspace/$orgSlug/settings/preferences",
)({
	component: PreferencesSettings,
});
