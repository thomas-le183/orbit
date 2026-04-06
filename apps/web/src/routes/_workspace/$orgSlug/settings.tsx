import { Button } from "@orbit/ui/components/button";
import { Field, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@orbit/ui/components/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { BillingSettings } from "@/components/workspace/billing-settings";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const { data: session } = useSession();
	const { orgSlug } = Route.useParams();
	const user = session?.user;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your account and workspace preferences.
				</p>
			</div>

			<Tabs>
				<TabsList>
					<TabsTrigger value="profile">Profile</TabsTrigger>
					<TabsTrigger value="workspace">Workspace</TabsTrigger>
					<TabsTrigger value="billing">Billing</TabsTrigger>
					<TabsTrigger value="notifications">Notifications</TabsTrigger>
				</TabsList>

				<TabsContent value="profile" className="mt-6 space-y-4">
					<Field>
						<FieldLabel>Full name</FieldLabel>
						<Input defaultValue={user?.name ?? ""} />
					</Field>
					<Field>
						<FieldLabel>Email</FieldLabel>
						<Input defaultValue={user?.email ?? ""} disabled />
					</Field>
					<Button size="sm">Save changes</Button>
				</TabsContent>

				<TabsContent value="workspace" className="mt-6 space-y-4">
					<Field>
						<FieldLabel>Workspace name</FieldLabel>
						<Input placeholder="My workspace" />
					</Field>
					<Button size="sm">Save changes</Button>
				</TabsContent>

				<TabsContent value="billing" className="mt-6">
					<BillingSettings orgSlug={orgSlug} />
				</TabsContent>

				<TabsContent value="notifications" className="mt-6">
					<div className="rounded-xl border p-5">
						<p className="text-sm text-muted-foreground">
							Notification preferences coming soon.
						</p>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
