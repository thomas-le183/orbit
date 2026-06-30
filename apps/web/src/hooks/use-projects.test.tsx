import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { projectKeys, useCreateProject, useProjects } from "./use-projects";

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
	return { qc, Wrapper };
}

describe("useProjects", () => {
	beforeEach(() => vi.clearAllMocks());

	it("fetches projects from GET /projects", async () => {
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "p1", name: "Alpha" }],
		});
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjects("acme"), {
			wrapper: Wrapper,
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects");
		expect(result.current.data).toEqual([{ id: "p1", name: "Alpha" }]);
	});

	it("is disabled when orgSlug is empty", () => {
		const { Wrapper } = makeWrapper();
		const { result } = renderHook(() => useProjects(""), { wrapper: Wrapper });
		expect(result.current.fetchStatus).toBe("idle");
		expect(api.get).not.toHaveBeenCalled();
	});
});

describe("useCreateProject", () => {
	beforeEach(() => vi.clearAllMocks());

	it("posts to /projects and invalidates the list key", async () => {
		(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { id: "p2", name: "Beta" },
		});
		const { qc, Wrapper } = makeWrapper();
		const invalidate = vi.spyOn(qc, "invalidateQueries");
		const { result } = renderHook(() => useCreateProject("acme"), {
			wrapper: Wrapper,
		});
		await result.current.mutateAsync({ name: "Beta" });
		expect(api.post).toHaveBeenCalledWith("/projects", { name: "Beta" });
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: projectKeys.list("acme"),
		});
	});
});
