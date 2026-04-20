import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSaveIndicator } from "./use-save-indicator";

describe("useSaveIndicator", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts false", () => {
		const { result } = renderHook(() => useSaveIndicator());
		expect(result.current.saved).toBe(false);
	});

	it("flips to true on trigger then back to false after default 1500ms", () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useSaveIndicator());

		act(() => result.current.trigger());
		expect(result.current.saved).toBe(true);

		act(() => vi.advanceTimersByTime(1500));
		expect(result.current.saved).toBe(false);
	});

	it("respects custom duration", () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useSaveIndicator(500));

		act(() => result.current.trigger());
		act(() => vi.advanceTimersByTime(499));
		expect(result.current.saved).toBe(true);

		act(() => vi.advanceTimersByTime(1));
		expect(result.current.saved).toBe(false);
	});

	it("resets the timer when triggered again", () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useSaveIndicator(1000));

		act(() => result.current.trigger());
		act(() => vi.advanceTimersByTime(800));
		expect(result.current.saved).toBe(true);

		act(() => result.current.trigger());
		act(() => vi.advanceTimersByTime(800));
		expect(result.current.saved).toBe(true);

		act(() => vi.advanceTimersByTime(200));
		expect(result.current.saved).toBe(false);
	});
});
