import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
	taskKeys,
	useCreateTask,
	useProjectMilestones,
	useProjectTasks,
	useUpdateTask,
} from "./use-tasks";

vi.mock("@/lib/api", () => ({
	api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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
	return { Wrapper, qc };
}

beforeEach(() => vi.clearAllMocks());

describe("useProjectTasks", () => {
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
	it("posts to the project tasks endpoint and invalidates the list", async () => {
		(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { id: "t9", name: "New" },
		});
		const { Wrapper, qc } = makeWrapper();
		const invalidate = vi.spyOn(qc, "invalidateQueries");
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

describe("useUpdateTask", () => {
	const seed = [{ id: "t1", name: "Task" }];
	const dates = { startDate: "2026-07-01", endDate: "2026-07-07" };

	it("reconciles the server row into the cache without refetching", async () => {
		const server = { id: "t1", name: "Task", ...dates };
		(api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: server });
		const { Wrapper, qc } = makeWrapper();
		qc.setQueryData(taskKeys.list("proj1"), seed);
		const invalidate = vi.spyOn(qc, "invalidateQueries");

		const { result } = renderHook(() => useUpdateTask("proj1"), {
			wrapper: Wrapper,
		});
		await result.current.mutateAsync({ id: "t1", input: dates });

		expect(api.patch).toHaveBeenCalledWith("/tasks/t1", dates);
		expect(qc.getQueryData(taskKeys.list("proj1"))).toEqual([server]);
		// The in-place reconcile exists precisely to avoid a refetch.
		expect(invalidate).not.toHaveBeenCalled();
	});

	it("applies the patch optimistically, before the server responds", async () => {
		let resolvePatch: (v: { data: unknown }) => void = () => {};
		(api.patch as ReturnType<typeof vi.fn>).mockReturnValue(
			new Promise((res) => {
				resolvePatch = res;
			}),
		);
		const { Wrapper, qc } = makeWrapper();
		qc.setQueryData(taskKeys.list("proj1"), seed);

		const { result } = renderHook(() => useUpdateTask("proj1"), {
			wrapper: Wrapper,
		});
		const pending = result.current.mutateAsync({ id: "t1", input: dates });

		// The cache carries the patch while the request is still in flight.
		await waitFor(() =>
			expect(qc.getQueryData(taskKeys.list("proj1"))).toEqual([
				{ id: "t1", name: "Task", ...dates },
			]),
		);

		resolvePatch({ data: { id: "t1", name: "Task", ...dates } });
		await pending;
	});

	it("rolls back to the pre-mutation snapshot when the patch fails", async () => {
		(api.patch as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("boom"),
		);
		const { Wrapper, qc } = makeWrapper();
		qc.setQueryData(taskKeys.list("proj1"), seed);

		const { result } = renderHook(() => useUpdateTask("proj1"), {
			wrapper: Wrapper,
		});
		await expect(
			result.current.mutateAsync({ id: "t1", input: { name: "Renamed" } }),
		).rejects.toThrow("boom");

		expect(qc.getQueryData(taskKeys.list("proj1"))).toEqual(seed);
		expect(toast.error).toHaveBeenCalled();
	});
});
