import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
	taskKeys,
	useCreateTask,
	useProjectMilestones,
	useProjectTasks,
} from "./use-tasks";

vi.mock("@/lib/api", () => ({
	api: { get: vi.fn(), post: vi.fn() },
	getErrorMessage: () => "error",
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeWrapper() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const Wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
	return { Wrapper };
}

describe("useProjectTasks", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fetches tasks for the project", async () => {
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "t1", name: "Task" }],
		});
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjectTasks("proj1"), {
			wrapper: Wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects/proj1/tasks");
		expect(result.current.data).toEqual([{ id: "t1", name: "Task" }]);
	});

	it("is disabled without a projectId", () => {
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjectTasks(""), {
			wrapper: Wrapper,
		});
		expect(result.current.fetchStatus).toBe("idle");
		expect(api.get).not.toHaveBeenCalled();
	});
});

describe("useProjectMilestones", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fetches milestones for the project", async () => {
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "m1", name: "MS", date: "2026-07-01" }],
		});
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjectMilestones("proj1"), {
			wrapper: Wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects/proj1/milestones");
	});
});

describe("useCreateTask", () => {
	beforeEach(() => vi.clearAllMocks());

	it("posts to the project tasks endpoint and invalidates the list", async () => {
		(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { id: "t9", name: "New" },
		});
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const invalidate = vi.spyOn(qc, "invalidateQueries");
		const Wrapper = ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={qc}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(() => useCreateTask("proj1"), {
			wrapper: Wrapper,
		});
		await result.current.mutateAsync({ name: "New" });
		expect(api.post).toHaveBeenCalledWith("/projects/proj1/tasks", {
			name: "New",
		});
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: taskKeys.list("proj1"),
		});
	});
});
