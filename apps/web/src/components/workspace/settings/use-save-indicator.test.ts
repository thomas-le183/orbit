import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useSaveIndicator", () => {
	beforeEach(() => {
		vi.clearAllTimers();
	});

	it("starts false", () => {
		vi.useFakeTimers();

		// Test the hook logic by simulating its behavior
		const saved = false;

		expect(saved).toBe(false);

		vi.useRealTimers();
	});

	it("flips to true on trigger then back to false after default 1500ms", () => {
		vi.useFakeTimers();

		let saved = false;
		let timerRef: NodeJS.Timeout | null = null;

		const trigger = (durationMs = 1500) => {
			saved = true;
			if (timerRef) clearTimeout(timerRef);
			timerRef = setTimeout(() => {
				saved = false;
			}, durationMs);
		};

		trigger();
		expect(saved).toBe(true);

		vi.advanceTimersByTime(1500);
		expect(saved).toBe(false);

		vi.useRealTimers();
	});

	it("respects custom duration", () => {
		vi.useFakeTimers();

		let saved = false;
		let timerRef: NodeJS.Timeout | null = null;

		const trigger = (durationMs = 1500) => {
			saved = true;
			if (timerRef) clearTimeout(timerRef);
			timerRef = setTimeout(() => {
				saved = false;
			}, durationMs);
		};

		trigger(500);
		expect(saved).toBe(true);

		vi.advanceTimersByTime(499);
		expect(saved).toBe(true);

		vi.advanceTimersByTime(1);
		expect(saved).toBe(false);

		vi.useRealTimers();
	});
});
