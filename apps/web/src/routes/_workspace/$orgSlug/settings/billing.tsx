import { createFileRoute } from "@tanstack/react-router";
import { BillingSettings } from "@/components/workspace/settings/billing-settings";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
	component: BillingSettingsPage,
});

function BillingSettingsPage() {
	const { orgSlug } = Route.useParams();
	return <BillingSettings orgSlug={orgSlug} />;
}
