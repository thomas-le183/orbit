import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Notification {
	id: string;
	userId: string;
	type: string;
	title: string;
	body: string;
	read: boolean;
	metadata: Record<string, string> | null;
	createdAt: string;
}

export const notificationKeys = {
	list: ["notifications", "list"] as const,
	unreadCount: ["notifications", "unread-count"] as const,
};

export function useNotifications() {
	return useQuery({
		queryKey: notificationKeys.list,
		queryFn: async () => {
			const { data } = await api.get<Notification[]>("/notifications");
			return data;
		},
		refetchInterval: 30_000,
	});
}

export function useUnreadNotificationCount() {
	return useQuery({
		queryKey: notificationKeys.unreadCount,
		queryFn: async () => {
			const { data } = await api.get<{ count: number }>(
				"/notifications/unread-count",
			);
			return data.count;
		},
		refetchInterval: 30_000,
	});
}

export function useMarkNotificationRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			await api.patch(`/notifications/${id}/read`);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: notificationKeys.list });
			qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
		},
	});
}

export function useMarkAllNotificationsRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await api.patch("/notifications/read-all");
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: notificationKeys.list });
			qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
		},
	});
}
