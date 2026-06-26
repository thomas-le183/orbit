import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import TimelineContainer from "./index";

function renderWithClient(ui: ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>{ui}</QueryClientProvider>,
	);
}

// The canvas measures its width via useResizeObserver. happy-dom's ResizeObserver
// never reports a size, so mock it to fire once with a fixed 800px content width.
const realResizeObserver = globalThis.ResizeObserver;
beforeAll(() => {
	class MockResizeObserver {
		private cb: ResizeObserverCallback;
		constructor(cb: ResizeObserverCallback) {
			this.cb = cb;
		}
		observe(target: Element) {
			this.cb(
				[
					{ target, contentRect: { width: 800, height: 100 } },
				] as unknown as ResizeObserverEntry[],
				this as unknown as ResizeObserver,
			);
		}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver =
		MockResizeObserver as unknown as typeof ResizeObserver;
});
afterAll(() => {
	globalThis.ResizeObserver = realResizeObserver;
});

describe("TimelineContainer", () => {
	it("mounts the header, grid, now-line and zoom control together", () => {
		const { container } = renderWithClient(<TimelineContainer />);
		expect(
			container.querySelector("[data-testid='timeline-header-top']"),
		).not.toBeNull();
		expect(
			container.querySelector("[data-testid='timeline-now-line']"),
		).not.toBeNull();
		// zoom control buttons (4 zoom level options)
		expect(
			container.querySelectorAll("button[data-slot='toggle-group-item']")
				.length,
		).toBe(4);
	});
});
