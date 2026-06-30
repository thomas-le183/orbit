import type { CreateTaskInput } from "@orbit/shared";
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
