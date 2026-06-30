import type { CreateProjectInput } from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";

export type Project = {
	id: string;
	organizationId: string;
	name: string;
	description: string | null;
	statusId: string;
	color: string | null;
	startDate: string | null;
	endDate: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
};

export const projectKeys = {
	all: ["projects"] as const,
	list: (orgSlug: string) => ["projects", "list", orgSlug] as const,
};

export function useProjects(orgSlug: string) {
	return useQuery({
		queryKey: projectKeys.list(orgSlug),
		queryFn: async () => {
			const { data } = await api.get<Project[]>("/projects");
			return data;
		},
		enabled: !!orgSlug,
	});
}

export function useCreateProject(orgSlug: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateProjectInput) => {
			const { data } = await api.post<Project>("/projects", input);
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: projectKeys.list(orgSlug) });
			toast.success("Project created");
		},
		onError: (err) => {
			toast.error(getErrorMessage(err, "Couldn't create project"));
		},
	});
}
