import type { CreateDependencyInput } from "@orbit/shared";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type TaskAssignee,
	type TimelineItem,
	timelineItems,
} from "@/data/timeline-items";
import { useActiveOrgMembers } from "@/hooks/use-auth";
import {
	type Dependency,
	useCreateDependency,
	useDeleteDependency,
	useProjectDependencies,
} from "@/hooks/use-dependencies";
import {
	useProjectMilestones,
	useProjectTasks,
	useUpdateTask,
} from "@/hooks/use-tasks";
import { ONE_DAY, startOfUtcDay, toUtcDateString } from "../units/make-units";
import {
	type MilestoneMarker,
	mapProjectData,
	type UndatedTaskRow,
} from "./map-items";

/** Shift an item's own start/end dates by a whole-day delta. */
function shiftDates(item: TimelineItem, days: number): TimelineItem {
	const move = (iso: string) =>
		toUtcDateString(startOfUtcDay(Date.parse(iso)) + days * ONE_DAY);
	return {
		...item,
		startDate: move(item.startDate),
		endDate: move(item.endDate),
	};
}

type TimelineDataValue = {
	items: TimelineItem[];
	updateItem: (id: string, patch: Partial<TimelineItem>) => void;
	moveDays: (id: string, days: number) => void;
	undatedTaskRows: UndatedTaskRow[];
	/** Assign dates to an undated task, scheduling it onto the timeline. */
	scheduleTask: (id: string, startDate: string, endDate: string) => void;
	milestoneMarkers: MilestoneMarker[];
	isLoading: boolean;
	isError: boolean;
	projectId: string | undefined;
	dependencies: Dependency[];
	createDependency: (input: CreateDependencyInput) => void;
	deleteDependency: (id: string) => void;
};

const TimelineDataContext = createContext<TimelineDataValue | null>(null);

export function TimelineDataProvider({
	projectId,
	children,
}: {
	projectId?: string;
	children: ReactNode;
}) {
	const tasksQuery = useProjectTasks(projectId ?? "");
	const milestonesQuery = useProjectMilestones(projectId ?? "");
	const updateTask = useUpdateTask(projectId ?? "");
	const dependenciesQuery = useProjectDependencies(projectId ?? "");
	const createDependencyMut = useCreateDependency(projectId ?? "");
	const deleteDependencyMut = useDeleteDependency(projectId ?? "");
	const membersQuery = useActiveOrgMembers();

	const assigneeById = useMemo(() => {
		const map = new Map<string, TaskAssignee>();
		for (const m of membersQuery.data?.members ?? []) {
			map.set(m.userId, {
				id: m.userId,
				name: m.user.name,
				avatarUrl: m.user.image ?? "",
			});
		}
		return map;
	}, [membersQuery.data]);

	const mapped = useMemo(() => {
		if (!projectId) {
			return {
				items: timelineItems,
				undatedTaskRows: [] as UndatedTaskRow[],
				milestoneMarkers: [] as MilestoneMarker[],
			};
		}
		return mapProjectData(
			tasksQuery.data ?? [],
			milestonesQuery.data ?? [],
			assigneeById,
		);
	}, [projectId, tasksQuery.data, milestonesQuery.data, assigneeById]);

	const [items, setItems] = useState<TimelineItem[]>(mapped.items);

	// Reseed local state when the underlying source changes (query resolves or
	// project switches). mapped.items keeps a stable ref between renders unless
	// the query data actually changed, so this does not clobber local edits on
	// unrelated re-renders. Local edits intentionally reset on refetch.
	useEffect(() => {
		setItems(mapped.items);
	}, [mapped.items]);

	const updateItem = useCallback((id: string, patch: Partial<TimelineItem>) => {
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
	}, []);

	const scheduleTask = useCallback(
		(id: string, startDate: string, endDate: string) => {
			updateTask.mutate({ id, input: { startDate, endDate } });
		},
		[updateTask],
	);

	const createDependency = useCallback(
		(input: CreateDependencyInput) => createDependencyMut.mutate(input),
		[createDependencyMut.mutate],
	);

	const deleteDependency = useCallback(
		(id: string) => deleteDependencyMut.mutate(id),
		[deleteDependencyMut.mutate],
	);

	const moveDays = useCallback((id: string, days: number) => {
		if (days === 0) return;
		setItems((prev) => {
			const hasChildren = prev.some((i) => i.parentId === id);
			if (!hasChildren) {
				return prev.map((i) => (i.id === id ? shiftDates(i, days) : i));
			}
			const descendants = new Set<string>();
			let added = true;
			while (added) {
				added = false;
				for (const i of prev) {
					if (
						i.parentId &&
						(i.parentId === id || descendants.has(i.parentId)) &&
						!descendants.has(i.id)
					) {
						descendants.add(i.id);
						added = true;
					}
				}
			}
			return prev.map((i) =>
				descendants.has(i.id) && !prev.some((c) => c.parentId === i.id)
					? shiftDates(i, days)
					: i,
			);
		});
	}, []);

	const value = useMemo<TimelineDataValue>(
		() => ({
			items,
			updateItem,
			moveDays,
			undatedTaskRows: mapped.undatedTaskRows,
			scheduleTask,
			milestoneMarkers: mapped.milestoneMarkers,
			isLoading: projectId
				? tasksQuery.isLoading || milestonesQuery.isLoading
				: false,
			isError: projectId
				? tasksQuery.isError || milestonesQuery.isError
				: false,
			projectId,
			dependencies: projectId ? (dependenciesQuery.data ?? []) : [],
			createDependency,
			deleteDependency,
		}),
		[
			items,
			updateItem,
			moveDays,
			mapped.undatedTaskRows,
			scheduleTask,
			mapped.milestoneMarkers,
			projectId,
			tasksQuery.isLoading,
			tasksQuery.isError,
			milestonesQuery.isLoading,
			milestonesQuery.isError,
			dependenciesQuery.data,
			createDependency,
			deleteDependency,
		],
	);

	return (
		<TimelineDataContext.Provider value={value}>
			{children}
		</TimelineDataContext.Provider>
	);
}

export function useTimelineData(): TimelineDataValue {
	const ctx = useContext(TimelineDataContext);
	if (!ctx) {
		throw new Error(
			"useTimelineData must be used within a TimelineDataProvider",
		);
	}
	return ctx;
}
