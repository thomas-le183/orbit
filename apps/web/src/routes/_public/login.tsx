import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/login-form";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_public/login")({
	validateSearch: (
		search: Record<string, unknown>,
	): { redirectTo?: string } => ({
		redirectTo:
			typeof search.redirectTo === "string" ? search.redirectTo : undefined,
	}),
	component: LoginPage,
});

function parseInviteId(redirectTo: string | undefined): string | null {
	if (!redirectTo) return null;
	const match = redirectTo.match(/^\/invite\/([^/]+)$/);
	return match?.[1] ?? null;
}

function LoginPage() {
	const { redirectTo } = useSearch({ from: "/_public/login" });
	const inviteId = parseInviteId(redirectTo);

	const { data: invitePreview } = useQuery({
		queryKey: ["invite-preview", inviteId],
		queryFn: async () => {
			const { data } = await api.get<{
				organizationName: string;
				organizationLogo: string | null;
			}>(`/invite/${inviteId}/preview`);
			return data;
		},
		enabled: !!inviteId,
		retry: false,
	});

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="bg-background-overlay-primary absolute inset-0 -z-10" />
			<div className="w-full max-w-sm">
				<LoginForm redirectTo={redirectTo} invitePreview={invitePreview} />
			</div>
		</div>
	);
}
