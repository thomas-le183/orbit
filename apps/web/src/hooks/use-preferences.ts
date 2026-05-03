import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";

export type UserPreferences = {
	theme: "light" | "dark" | "system";
	language: string;
	dateFormat: string;
	timezone: string;
	weekStart: 0 | 1;
};

type UpdateUserPreferencesInput = Partial<UserPreferences>;

export const preferencesKeys = {
	all: ["preferences"] as const,
};

export function usePreferences() {
	return useQuery({
		queryKey: preferencesKeys.all,
		queryFn: async () => {
			const { data } = await api.get<UserPreferences>("/preferences");
			return data;
		},
	});
}

export function useUpdatePreferences() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: UpdateUserPreferencesInput) => {
			const { data } = await api.patch<UserPreferences>("/preferences", input);
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: preferencesKeys.all });
			toast.success("Preferences saved");
		},
	});
}
