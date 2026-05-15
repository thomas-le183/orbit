import { Button } from "@orbit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@orbit/ui/components/card";
import { Spinner } from "@orbit/ui/components/spinner";
import {
	createFileRoute,
	redirect,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { toast } from "sonner";
import {
	loadAuthState,
	useAcceptInvitation,
	useGetInvitation,
	useSession,
	useSignOut,
} from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/invite/$invitationId")({
	beforeLoad: async ({ context, params }) => {
		const state = await loadAuthState(context.queryClient);
		if (!state.user) {
			throw redirect({
				to: "/login",
				search: { redirectTo: `/invite/${params.invitationId}` },
			});
		}
	},
	component: InvitePage,
});

function InvitePage() {
	const { invitationId } = useParams({ from: "/invite/$invitationId" });
	const navigate = useNavigate();
	const { data: invitation, isLoading, error } = useGetInvitation(invitationId);
	const accept = useAcceptInvitation();
	const signOut = useSignOut();
	const { data: session } = useSession();

	const isWrongAccount = (error as { status?: number } | null)?.status === 403;

	if (isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (isWrongAccount) {
		return (
			<div className="flex min-h-svh items-center justify-center p-4">
				<Card className="w-full max-w-sm text-center">
					<CardHeader>
						<CardTitle>Wrong account</CardTitle>
						<CardDescription>
							This invitation was sent to a different email address.
							{session?.user?.email && (
								<> You&apos;re currently signed in as <strong>{session.user.email}</strong>.</>
							)}{" "}
							Sign out and sign in with the invited email to continue.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center gap-2">
						<Button
							variant="outline"
							onClick={() => navigate({ to: "/" })}
						>
							Go home
						</Button>
						<Button
							onClick={() =>
								signOut.mutate(undefined, {
									onSuccess: () =>
										navigate({
											to: "/login",
											search: { redirectTo: `/invite/${invitationId}` },
										}),
								})
							}
							disabled={signOut.isPending}
						>
							{signOut.isPending ? <Spinner data-icon="inline-start" /> : null}
							Sign out
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	if (error || !invitation) {
		return (
			<div className="flex min-h-svh items-center justify-center p-4">
				<Card className="w-full max-w-sm text-center">
					<CardHeader>
						<CardTitle>Invitation not found</CardTitle>
						<CardDescription>
							This invitation may have expired or already been accepted.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-center">
						<Button variant="outline" onClick={() => navigate({ to: "/" })}>
							Go home
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle>You're invited!</CardTitle>
					<CardDescription>
						Join <strong>{invitation.organizationName}</strong> on Orbit.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Button
						className="w-full"
						disabled={accept.isPending}
						onClick={async () => {
							try {
								await accept.mutateAsync(invitationId);
								navigate({
									to: "/$orgSlug",
									params: { orgSlug: invitation.organizationSlug },
								});
							} catch (err) {
								toast.error(
									getErrorMessage(err, "Failed to accept invitation"),
								);
							}
						}}
					>
						{accept.isPending ? (
							<>
								<Spinner data-icon="inline-start" /> Accepting…
							</>
						) : (
							"Accept invitation"
						)}
					</Button>
					<Button
						variant="outline"
						className="w-full"
						disabled={accept.isPending}
						onClick={() => navigate({ to: "/" })}
					>
						Decline
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
