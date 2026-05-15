import { createFileRoute, redirect } from "@tanstack/react-router";
import { InviteMemberModal } from "@/components/workspace/settings/invite-member-modal";
import { MembersTable } from "@/components/workspace/settings/members-table";
import { loadOrgRole, useOrgMembers, useSession } from "@/hooks/use-auth";
import { useBillingSummary } from "@/hooks/use-billing";

export const Route = createFileRoute("/_workspace/$orgSlug/settings/members")({
	beforeLoad: async ({ context, params }) => {
		const { authState, targetOrg } = context;
		const role = await loadOrgRole(
			context.queryClient,
			targetOrg.id,
			authState.user?.id ?? "",
		);
		if (role === "member" || role === null) {
			throw redirect({ to: "/$orgSlug", params });
		}
	},
	component: MembersPage,
});

function MembersPage() {
	const { orgSlug } = Route.useParams();
	const { targetOrg } = Route.useRouteContext() as {
		targetOrg: { id: string };
	};
	const { data: org, isLoading } = useOrgMembers(targetOrg.id);
	const { data: session } = useSession();
	const { data: billingSummary } = useBillingSummary(orgSlug);

	if (isLoading || !org || !session) return null;

	const currentMember = org.members?.find((m) => m.userId === session.user.id);
	const currentRole = currentMember?.role ?? "member";

	return (
		<MembersTable
			members={org.members ?? []}
			invitations={(org.invitations ?? []).filter(
				(i) => i.status === "pending",
			)}
			organizationId={targetOrg.id}
			currentUserId={session.user.id}
			currentRole={currentRole}
			inviteSlot={
				<InviteMemberModal
					organizationId={targetOrg.id}
					plan={billingSummary?.plan ?? null}
					pricePerSeat={billingSummary?.pricePerSeat ?? null}
					billingInterval={billingSummary?.billingInterval ?? null}
				/>
			}
		/>
	);
}
