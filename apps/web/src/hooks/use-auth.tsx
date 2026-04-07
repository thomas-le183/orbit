import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

// ─── Query keys ───────────────────────────────────────────────

export const authKeys = {
	session: ["auth", "session"] as const,
	organizations: ["auth", "organizations"] as const,
	activeOrg: ["auth", "active-organization"] as const,
	fullOrg: (orgId: string) => ["auth", "organization", orgId] as const,
	members: ["auth", "members"] as const,
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

export function useActiveOrganization() {
	return useQuery({
		queryKey: authKeys.activeOrg,
		queryFn: async () => {
			const { data } = await authClient.organization.getFullOrganization();
			return data;
		},
	});
}

export function useMembers() {
	return useQuery({
		queryKey: authKeys.members,
		queryFn: async () => {
			const { data } = await authClient.organization.getFullOrganization();
			return data?.members ?? [];
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
			const { data, error } = await authClient.signUp.email(input);
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.session });
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
			// Only refresh the active-org cache. Do NOT invalidate the session
			// query — the URL slug is the source of truth for which org is
			// active, and refetching the session mid-navigation causes every
			// `useSession` consumer (topnav, sidebar) to re-render and flash.
			qc.invalidateQueries({ queryKey: authKeys.activeOrg });
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
			data: { name?: string; slug?: string };
		}) => {
			const { data, error } = await authClient.organization.update(input);
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.organizations });
			qc.invalidateQueries({ queryKey: authKeys.activeOrg });
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
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: authKeys.organizations });
			qc.invalidateQueries({ queryKey: authKeys.activeOrg });
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
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: authKeys.members,
			});
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
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: authKeys.members,
			});
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
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: authKeys.members,
			});
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

export type AuthState = {
	session: Awaited<ReturnType<typeof sessionQueryOptions.queryFn>>;
	organizations: Awaited<ReturnType<typeof organizationsQueryOptions.queryFn>>;
};

/**
 * Load the raw auth state via `ensureQueryData`.
 * Makes no routing decisions — callers decide what to do with the state.
 */
export async function loadAuthState(
	queryClient: QueryClient,
): Promise<AuthState> {
	const [session, organizations] = await Promise.all([
		queryClient.ensureQueryData(sessionQueryOptions),
		queryClient.ensureQueryData(organizationsQueryOptions),
	]);

	return { session, organizations: organizations ?? [] };
}

/**
 * Given an authenticated user's state, decide where they should land when
 * no workspace slug is present in the URL. Returns `null` if the user is
 * unauthenticated (caller should allow the current public route to render).
 */
export function resolveAuthenticatedLanding(state: AuthState) {
	if (!state.session?.user) return null;

	if (!state.session.user.name) {
		return { to: "/onboarding" } as const;
	}

	if (state.organizations.length === 0) {
		return { to: "/create-workspace" } as const;
	}

	const active =
		state.organizations.find(
			(o) => o.id === state.session?.session.activeOrganizationId,
		) ?? state.organizations[0];

	return {
		to: "/$orgSlug",
		params: { orgSlug: active.slug },
	} as const;
}
