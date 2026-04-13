import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface PresenceRecord {
	userId: string;
	organizationId: string;
	status: string;
	lastSeenAt: string | null;
	updatedAt: string;
}

export function useOrgPresence() {
	return useQuery({
		queryKey: ["presence", "org"],
		queryFn: async () => {
			const { data } = await api.get<PresenceRecord[]>("/presence");
			return data;
		},
		refetchInterval: 30_000,
	});
}

export function formatLastSeen(presence: PresenceRecord | undefined): string {
	if (!presence) return "—";
	if (presence.status === "online") return "Online now";
	const ts = presence.lastSeenAt ?? presence.updatedAt;
	const diff = Date.now() - new Date(ts).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
