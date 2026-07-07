import type { CreateTaskInput, UpdateTaskInput } from "@orbit/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";

export type Task = {
	id: string;
	projectId: string;
	parentId: string | null;
	name: string;
	description: string | null;
	statusId: string;
	priority: string;
	progress: number;
	estimatedTime: number | null;
	startDate: string | null;
	endDate: string | null;
	color: string | null;
	assigneeId: string | null;
	position: number;
	createdAt: string;
	updatedAt: string;
};

export type Milestone = {
	id: string;
	projectId: string;
	name: string;
	description: string | null;
	date: string;
	color: string | null;
	position: number;
	completedAt: string | null;
};

export const taskKeys = {
	list: (projectId: string) => ["tasks", "list", projectId] as const,
};

export const milestoneKeys = {
	list: (projectId: string) => ["milestones", "list", projectId] as const,
};

export function useProjectTasks(projectId: string) {
	return useQuery({
		queryKey: taskKeys.list(projectId),
		queryFn: async () => {
			const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`);
			return data;
		},
		enabled: !!projectId,
	});
}

export function useProjectMilestones(projectId: string) {
	return useQuery({
		queryKey: milestoneKeys.list(projectId),
		queryFn: async () => {
			const { data } = await api.get<Milestone[]>(
				`/projects/${projectId}/milestones`,
			);
			return data;
		},
		enabled: !!projectId,
	});
}

export function useCreateTask(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateTaskInput) => {
			const { data } = await api.post<Task>(
				`/projects/${projectId}/tasks`,
				input,
			);
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: taskKeys.list(projectId) });
			toast.success("Task created");
		},
		onError: (err) => {
			toast.error(getErrorMessage(err, "Couldn't create task"));
		},
	});
}

export function useUpdateTask(projectId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({
			id,
			input,
		}: {
			id: string;
			input: UpdateTaskInput;
		}) => {
			const { data } = await api.patch<Task>(`/tasks/${id}`, input);
			return data;
		},
		onMutate: async ({ id, input }) => {
			// Optimistically apply the patch so the timeline reflects it instantly,
			// before the PATCH + refetch round-trip completes.
			await qc.cancelQueries({ queryKey: taskKeys.list(projectId) });
			const previous = qc.getQueryData<Task[]>(taskKeys.list(projectId));
			qc.setQueryData<Task[]>(taskKeys.list(projectId), (tasks) =>
				tasks?.map((t) => (t.id === id ? { ...t, ...input } : t)),
			);
			return { previous };
		},
		onSuccess: (updated) => {
			// Reconcile with the server's authoritative row in place — no refetch.
			qc.setQueryData<Task[]>(taskKeys.list(projectId), (tasks) =>
				tasks?.map((t) => (t.id === updated.id ? updated : t)),
			);
		},
		onError: (err, _vars, context) => {
			// Roll back to the pre-mutation snapshot.
			if (context?.previous) {
				qc.setQueryData(taskKeys.list(projectId), context.previous);
			}
			toast.error(getErrorMessage(err, "Couldn't update task"));
		},
	});
}
