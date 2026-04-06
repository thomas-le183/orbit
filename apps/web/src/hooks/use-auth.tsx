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
			qc.invalidateQueries({ queryKey: authKeys.activeOrg });
			qc.invalidateQueries({ queryKey: authKeys.session });
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

// ─── Auth redirect helper ────────────────────────────────────

type AuthRedirectResult =
	| { status: "loading" }
	| { status: "unauthenticated" }
	| {
			status: "authenticated";
			redirect: { to: string; params?: Record<string, string> };
	  };

/**
 * Resolves where an authenticated user should land.
 * Shared across index, _public, and _workspace guards.
 */
export function useAuthRedirect(): AuthRedirectResult {
	const { data: session, isPending: sessionPending } = useSession();
	const { data: organizations, isPending: orgsPending } = useOrganizations();

	if (sessionPending || orgsPending) {
		return { status: "loading" };
	}

	if (!session?.user) {
		return { status: "unauthenticated" };
	}

	if (!session.user.name) {
		return { status: "authenticated", redirect: { to: "/onboarding" } };
	}

	if (!organizations || organizations.length === 0) {
		return { status: "authenticated", redirect: { to: "/create-workspace" } };
	}

	const activeOrg = organizations.find(
		(o) => o.id === session.session.activeOrganizationId,
	);
	const org = activeOrg ?? organizations[0];

	return {
		status: "authenticated",
		redirect: { to: "/$orgSlug", params: { orgSlug: org.slug } },
	};
}
