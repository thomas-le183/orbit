import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

// ─── Query keys ───────────────────────────────────────────────

export const authKeys = {
	session: ["auth", "session"] as const,
	organizations: ["auth", "organizations"] as const,
	org: (orgId: string) => ["auth", "org", orgId] as const,
};

// ─── Queries ──────────────────────────────────────────────────

export function useSession() {
	return useQuery({
		queryKey: authKeys.session,
		queryFn: async () => {
			const { data } = await authClient.getSession();
			return data;
		},
	});
}

export function useOrganizations() {
	return useQuery({
		queryKey: authKeys.organizations,
		queryFn: async () => {
			const { data } = await authClient.organization.list();
			return data ?? [];
		},
	});
}

// ─── Mutations ────────────────────────────────────────────────

export function useSignIn() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: { email: string; password: string }) => {
			const { data, error } = await authClient.signIn.email(input);
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.session });
			qc.invalidateQueries({ queryKey: authKeys.organizations });
		},
	});
}

export function useSignUp() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			email: string;
			password: string;
			name: string;
		}) => {
			const { data, error } = await authClient.signUp.email({
				...input,
				callbackURL: `${import.meta.env.VITE_WEB_BASE_URL}/`,
			});
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.session });
			qc.invalidateQueries({ queryKey: authKeys.organizations });
		},
	});
}

export function useSendVerificationEmail() {
	return useMutation({
		mutationFn: async (email: string) => {
			const { error } = await authClient.sendVerificationEmail({
				email,
				callbackURL: `${import.meta.env.VITE_WEB_BASE_URL}/`,
			});
			if (error) throw error;
		},
	});
}

export function useSignOut() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await authClient.signOut();
		},
		onSuccess: () => {
			qc.clear();
		},
	});
}

export function useSetActiveOrganization() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (organizationId: string) => {
			const { data, error } = await authClient.organization.setActive({
				organizationId,
			});
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			// Refresh session so activeOrganizationId stays current.
			// Org data itself doesn't change on setActive — no need to invalidate it.
			qc.invalidateQueries({ queryKey: authKeys.session });
		},
	});
}

export function useUpdateUser() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: { name?: string; image?: string | null }) => {
			const { data, error } = await authClient.updateUser(input);
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.session });
		},
	});
}

export function useDeleteAccount() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { data, error } = await authClient.deleteUser();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.clear();
		},
	});
}

export function useCreateOrganization() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: { name: string; slug: string }) => {
			const { data, error } = await authClient.organization.create(input);
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.organizations });
		},
	});
}

export function useUpdateOrganization() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			organizationId: string;
			data: { name?: string; slug?: string; logo?: string };
		}) => {
			const { data, error } = await authClient.organization.update(input);
			if (error) throw error;
			return data;
		},
		onSuccess: (_, { organizationId }) => {
			qc.invalidateQueries({ queryKey: authKeys.organizations });
			qc.invalidateQueries({ queryKey: authKeys.org(organizationId) });
		},
	});
}

export function useDeleteOrganization() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (organizationId: string) => {
			const { data, error } = await authClient.organization.delete({
				organizationId,
			});
			if (error) throw error;
			return data;
		},
		onSuccess: (_, organizationId) => {
			qc.invalidateQueries({ queryKey: authKeys.organizations });
			qc.removeQueries({ queryKey: authKeys.org(organizationId) });
		},
	});
}

export function useInviteMember() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			organizationId: string;
			email: string;
			role: "member" | "admin" | "owner";
		}) => {
			const { data, error } = await authClient.organization.inviteMember(input);
			if (error) throw error;
			return data;
		},
		onSuccess: (_, { organizationId }) => {
			qc.invalidateQueries({ queryKey: authKeys.org(organizationId) });
		},
	});
}

export function useRemoveMember() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			organizationId: string;
			memberIdOrEmail: string;
		}) => {
			const { data, error } = await authClient.organization.removeMember(input);
			if (error) throw error;
			return data;
		},
		onSuccess: (_, { organizationId }) => {
			qc.invalidateQueries({ queryKey: authKeys.org(organizationId) });
		},
	});
}

export function useUpdateMemberRole() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			organizationId: string;
			memberId: string;
			role: "member" | "admin" | "owner";
		}) => {
			const { data, error } =
				await authClient.organization.updateMemberRole(input);
			if (error) throw error;
			return data;
		},
		onSuccess: (_, { organizationId }) => {
			qc.invalidateQueries({ queryKey: authKeys.org(organizationId) });
		},
	});
}

export function useOrgMembers(organizationId: string | undefined) {
	return useQuery({
		queryKey: ["auth", "org-full", organizationId],
		queryFn: async () => {
			if (!organizationId) throw new Error("organizationId is required");
			const { data, error } = await authClient.organization.getFullOrganization(
				{
					query: { organizationId },
				},
			);
			if (error) throw error;
			return data;
		},
		enabled: !!organizationId,
	});
}

export function useOrgRole(organizationId: string | undefined) {
	const { data: session } = useSession();
	const { data: org } = useOrgMembers(organizationId);
	const currentUserId = session?.user?.id;
	const member = org?.members?.find((m) => m.userId === currentUserId);
	return member?.role ?? null;
}

export function useCancelInvitation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (invitationId: string) => {
			const { data, error } = await authClient.organization.cancelInvitation({
				invitationId,
			});
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["auth", "org-full"] });
		},
	});
}

// ─── Query options (usable in beforeLoad) ───────────────────

export const sessionQueryOptions = {
	queryKey: authKeys.session,
	queryFn: async () => {
		const { data } = await authClient.getSession();
		return data;
	},
};

export const organizationsQueryOptions = {
	queryKey: authKeys.organizations,
	queryFn: async () => {
		const { data } = await authClient.organization.list();
		return data ?? [];
	},
};

// ─── Auth state helpers (for beforeLoad) ────────────────────

import type { QueryClient } from "@tanstack/react-query";

type SessionData = Awaited<ReturnType<typeof sessionQueryOptions.queryFn>>;

export type AuthState = {
	user: NonNullable<SessionData>["user"] | null;
	session: NonNullable<SessionData>["session"] | null;
	organizations: Awaited<ReturnType<typeof organizationsQueryOptions.queryFn>>;
};

/**
 * Load auth state for use in `beforeLoad` guards.
 * Uses `fetchQuery` so stale data (e.g. after sign-in/sign-out) is always
 * re-fetched before routing decisions are made.
 */
export async function loadAuthState(
	queryClient: QueryClient,
): Promise<AuthState> {
	const [sessionData, organizations] = await Promise.all([
		queryClient.fetchQuery(sessionQueryOptions),
		queryClient.fetchQuery(organizationsQueryOptions),
	]);

	return {
		user: sessionData?.user ?? null,
		session: sessionData?.session ?? null,
		organizations: organizations ?? [],
	};
}

/**
 * Load the current user's role in an org for use in `beforeLoad` guards.
 * Reuses the same cache entry as `useOrgMembers` to avoid duplicate fetches.
 */
export async function loadOrgRole(
	queryClient: QueryClient,
	orgId: string,
	userId: string,
): Promise<"owner" | "admin" | "member" | null> {
	const orgData = await queryClient.ensureQueryData({
		queryKey: ["auth", "org-full", orgId],
		queryFn: async () => {
			const { data, error } = await authClient.organization.getFullOrganization(
				{
					query: { organizationId: orgId },
				},
			);
			if (error) throw error;
			return data;
		},
	});
	const member = orgData?.members?.find(
		(m: { userId: string }) => m.userId === userId,
	);
	return (member?.role as "owner" | "admin" | "member" | null) ?? null;
}

/**
 * Given an authenticated user's state, decide where they should land.
 * Returns `null` if unauthenticated — caller should allow the route to render.
 */
export function resolveAuthenticatedLanding(state: AuthState) {
	if (!state.user) return null;

	if (!state.user.name) {
		return { to: "/onboarding" } as const;
	}

	if (state.organizations.length === 0) {
		return { to: "/create-workspace" } as const;
	}

	const active =
		state.organizations.find(
			(o) => o.id === state.session?.activeOrganizationId,
		) ?? state.organizations[0];

	return {
		to: "/$orgSlug",
		params: { orgSlug: active.slug },
	} as const;
}
