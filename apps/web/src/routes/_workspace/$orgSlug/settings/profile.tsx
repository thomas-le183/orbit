import { Button } from "@orbit/ui/components/button";
import { Field, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/profile")({
	component: ProfileSettings,
});

function ProfileSettings() {
	const { data: session } = useSession();
	const user = session?.user;

	return (
		<div className="space-y-4">
			<Field>
				<FieldLabel>Full name</FieldLabel>
				<Input defaultValue={user?.name ?? ""} />
			</Field>
			<Field>
				<FieldLabel>Email</FieldLabel>
				<Input defaultValue={user?.email ?? ""} disabled />
			</Field>
			<Button size="sm">Save changes</Button>
		</div>
	);
}
