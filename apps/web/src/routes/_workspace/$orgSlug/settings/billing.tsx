import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/workspace/settings/settings-page";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/billing")({
	component: BillingPage,
});

function BillingPage() {
	return (
		<SettingsPage title="Billing" subtitle="Manage your plan and invoices.">
			<div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
				Coming soon.
			</div>
		</SettingsPage>
	);
}
