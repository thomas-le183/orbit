import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectMilestones, useProjectTasks } from "@/hooks/use-tasks";
import { TimelineDataProvider, useTimelineData } from "./context";

vi.mock("@/hooks/use-tasks", () => ({
	useProjectTasks: vi.fn(),
	useProjectMilestones: vi.fn(),
	useUpdateTask: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/hooks/use-dependencies", () => ({
	useProjectDependencies: vi.fn(() => ({ data: undefined })),
	useCreateDependency: vi.fn(() => ({ mutate: vi.fn() })),
	useDeleteDependency: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/hooks/use-auth", () => ({
	useActiveOrgMembers: vi.fn(() => ({ data: undefined })),
}));

const tasksMock = useProjectTasks as unknown as ReturnType<typeof vi.fn>;
const milestonesMock = useProjectMilestones as unknown as ReturnType<
	typeof vi.fn
>;

function wrapper(projectId?: string) {
	return ({ children }: { children: ReactNode }) => (
		<TimelineDataProvider projectId={projectId}>
			{children}
		</TimelineDataProvider>
	);
}

describe("TimelineDataProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		tasksMock.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: false,
		});
		milestonesMock.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: false,
		});
	});

	it("seeds from the static seed when no projectId", () => {
		const { result } = renderHook(() => useTimelineData(), {
			wrapper: wrapper(),
		});
		expect(result.current.items.length).toBeGreaterThan(0);
		expect(useProjectTasks).toHaveBeenCalledWith("");
	});

	it("maps query data into items + markers when projectId given", () => {
		tasksMock.mockReturnValue({
			data: [
				{
					id: "t1",
					projectId: "p",
					parentId: null,
					name: "Alpha",
					description: null,
					statusId: "s",
					priority: "none",
					progress: 0,
					startDate: "2026-06-01",
					endDate: "2026-06-02",
					color: null,
					assigneeId: null,
					position: 0,
					createdAt: "",
					updatedAt: "",
				},
			],
			isLoading: false,
			isError: false,
		});
		milestonesMock.mockReturnValue({
			data: [
				{
					id: "m1",
					projectId: "p",
					name: "MS",
					description: null,
					date: "2026-07-01",
					color: null,
					position: 0,
					completedAt: null,
				},
			],
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useTimelineData(), {
			wrapper: wrapper("p"),
		});
		expect(result.current.items.map((i) => i.id)).toEqual(["t1"]);
		expect(result.current.milestoneMarkers.map((m) => m.id)).toEqual(["m1"]);
	});

	it("updateItem mutates local state", () => {
		tasksMock.mockReturnValue({
			data: [
				{
					id: "t1",
					projectId: "p",
					parentId: null,
					name: "Alpha",
					description: null,
					statusId: "s",
					priority: "none",
					progress: 0,
					startDate: "2026-06-01",
					endDate: "2026-06-02",
					color: null,
					assigneeId: null,
					position: 0,
					createdAt: "",
					updatedAt: "",
				},
			],
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useTimelineData(), {
			wrapper: wrapper("p"),
		});
		act(() => result.current.updateItem("t1", { name: "Renamed" }));
		expect(result.current.items.find((i) => i.id === "t1")?.name).toBe(
			"Renamed",
		);
	});

	it("surfaces loading/error from the queries (projectId mode)", () => {
		tasksMock.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		milestonesMock.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: false,
		});
		const { result } = renderHook(() => useTimelineData(), {
			wrapper: wrapper("p"),
		});
		expect(result.current.isLoading).toBe(true);
	});

	it("exposes the projectId in project mode and undefined in seed mode", () => {
		const project = renderHook(() => useTimelineData(), {
			wrapper: wrapper("p"),
		});
		expect(project.result.current.projectId).toBe("p");
		const seed = renderHook(() => useTimelineData(), { wrapper: wrapper() });
		expect(seed.result.current.projectId).toBeUndefined();
	});
});
