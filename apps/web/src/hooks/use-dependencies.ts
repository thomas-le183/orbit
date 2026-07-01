import type { CreateDependencyInput, DependencyType } from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";

export type Dependency = {
	id: string;
	projectId: string;
	predecessorId: string;
	successorId: string;
	type: DependencyType;
	createdAt?: string;
};

export const dependencyKeys = {
	list: (projectId: string) => ["dependencies", "list", projectId] as const,
};

export function useProjectDependencies(projectId: string) {
	return useQuery({
		queryKey: dependencyKeys.list(projectId),
		queryFn: async () => {
			const { data } = await api.get<Dependency[]>(
				`/projects/${projectId}/dependencies`,
			);
			return data;
		},
		enabled: !!projectId,
	});
}

export function useCreateDependency(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateDependencyInput) => {
			const { data } = await api.post<Dependency>(
				`/projects/${projectId}/dependencies`,
				input,
			);
			return data;
		},
		onMutate: async (input) => {
			await qc.cancelQueries({ queryKey: dependencyKeys.list(projectId) });
			const previous = qc.getQueryData<Dependency[]>(
				dependencyKeys.list(projectId),
			);
			const optimistic: Dependency = {
				id: `optimistic-${crypto.randomUUID()}`,
				projectId,
				...input,
			};
			qc.setQueryData<Dependency[]>(dependencyKeys.list(projectId), (deps) => [
				...(deps ?? []),
				optimistic,
			]);
			return { previous };
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: dependencyKeys.list(projectId) });
		},
		onError: (err, _vars, context) => {
			if (context?.previous) {
				qc.setQueryData(dependencyKeys.list(projectId), context.previous);
			}
			toast.error(getErrorMessage(err, "Couldn't create dependency"));
		},
	});
}

export function useDeleteDependency(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			await api.delete(`/dependencies/${id}`);
			return id;
		},
		onMutate: async (id) => {
			await qc.cancelQueries({ queryKey: dependencyKeys.list(projectId) });
			const previous = qc.getQueryData<Dependency[]>(
				dependencyKeys.list(projectId),
			);
			qc.setQueryData<Dependency[]>(dependencyKeys.list(projectId), (deps) =>
				deps?.filter((d) => d.id !== id),
			);
			return { previous };
		},
		onError: (err, _id, context) => {
			if (context?.previous) {
				qc.setQueryData(dependencyKeys.list(projectId), context.previous);
			}
			toast.error(getErrorMessage(err, "Couldn't delete dependency"));
		},
	});
}
