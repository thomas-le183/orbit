import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
	dependencyKeys,
	useCreateDependency,
	useProjectDependencies,
} from "./use-dependencies";

vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

function wrapper(qc: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

describe("useProjectDependencies", () => {
	it("fetches dependencies for the project", async () => {
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		(api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: [{ id: "d1", projectId: "p1", predecessorId: "a", successorId: "b", type: "FS" }],
		});
		const { result } = renderHook(() => useProjectDependencies("p1"), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(api.get).toHaveBeenCalledWith("/projects/p1/dependencies");
		expect(result.current.data?.[0].type).toBe("FS");
	});
});

describe("useCreateDependency", () => {
	it("posts to the dependencies endpoint and invalidates the list", async () => {
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const invalidate = vi.spyOn(qc, "invalidateQueries");
		(api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { id: "d1", projectId: "p1", predecessorId: "a", successorId: "b", type: "FS" },
		});
		const { result } = renderHook(() => useCreateDependency("p1"), {
			wrapper: wrapper(qc),
		});
		await result.current.mutateAsync({ predecessorId: "a", successorId: "b", type: "FS" });
		expect(api.post).toHaveBeenCalledWith("/projects/p1/dependencies", {
			predecessorId: "a",
			successorId: "b",
			type: "FS",
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: dependencyKeys.list("p1") });
	});
});
