import { createFileRoute } from "@tanstack/react-router";
import { InviteMemberModal } from "@/components/workspace/settings/invite-member-modal";
import { MembersTable } from "@/components/workspace/settings/members-table";
import { useOrgMembers, useSession } from "@/hooks/use-auth";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/members")({
	component: MembersPage,
});

function MembersPage() {
	const { targetOrg } = Route.useRouteContext() as any;
	const { data: org, isLoading } = useOrgMembers(targetOrg.id);
	const { data: session } = useSession();

	if (isLoading || !org || !session) return null;

	const currentMember = org.members?.find(
		(m: any) => m.userId === session.user.id,
	);
	const currentRole = currentMember?.role ?? "member";

	return (
		<div>
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h1 className="text-xl font-semibold">Members</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Manage who has access to this workspace.
					</p>
				</div>
				<InviteMemberModal organizationId={targetOrg.id} />
			</div>

			<MembersTable
				members={org.members ?? []}
				invitations={(org.invitations ?? []).filter(
					(i: any) => i.status === "pending",
				)}
				organizationId={targetOrg.id}
				currentUserId={session.user.id}
				currentRole={currentRole}
			/>
		</div>
	);
}
