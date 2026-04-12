import { Button } from "@orbit/ui/components/button";
import { Field, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/workspace")(
	{
		component: WorkspaceSettings,
	},
);

function WorkspaceSettings() {
	return (
		<div className="space-y-4">
			<Field>
				<FieldLabel>Workspace name</FieldLabel>
				<Input placeholder="My workspace" />
			</Field>
			<Button size="sm">Save changes</Button>
		</div>
	);
}
