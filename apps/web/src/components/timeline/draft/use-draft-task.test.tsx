import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftTaskProvider, useDraftTask } from "./use-draft-task";

const mutate = vi.fn();
vi.mock("@/hooks/use-tasks", () => ({
	useCreateTask: () => ({ mutate, isPending: false }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
	<DraftTaskProvider projectId="p1" enabled>
		{children}
	</DraftTaskProvider>
);

describe("useDraftTask", () => {
	beforeEach(() => mutate.mockReset());

	it("commits a name-only draft as an undated payload", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => result.current.setName("Beta"));
		act(() => result.current.commit());
		expect(mutate).toHaveBeenCalledWith({ name: "Beta" }, expect.any(Object));
	});

	it("commits a dragged draft with its dates", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => {
			result.current.setName("Gamma");
			result.current.setDates("2026-07-01", "2026-07-05");
		});
		act(() => result.current.commit());
		expect(mutate).toHaveBeenCalledWith(
			{ name: "Gamma", startDate: "2026-07-01", endDate: "2026-07-05" },
			expect.any(Object),
		);
	});

	it("does not commit an empty name", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => result.current.setName("   "));
		act(() => result.current.commit());
		expect(mutate).not.toHaveBeenCalled();
	});

	it("cancel clears name and dates", () => {
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => {
			result.current.setName("Delta");
			result.current.setDates("2026-07-01", "2026-07-05");
		});
		act(() => result.current.cancel());
		expect(result.current.name).toBe("");
		expect(result.current.startDate).toBeUndefined();
		expect(result.current.endDate).toBeUndefined();
	});

	it("resets on successful commit", () => {
		mutate.mockImplementation((_input, opts) => opts?.onSuccess?.());
		const { result } = renderHook(() => useDraftTask(), { wrapper });
		act(() => result.current.setName("Epsilon"));
		act(() => result.current.commit());
		expect(result.current.name).toBe("");
	});

	it("is disabled with no-op commit outside a provider", () => {
		const { result } = renderHook(() => useDraftTask());
		expect(result.current.enabled).toBe(false);
		act(() => result.current.commit());
		expect(mutate).not.toHaveBeenCalled();
	});
});
