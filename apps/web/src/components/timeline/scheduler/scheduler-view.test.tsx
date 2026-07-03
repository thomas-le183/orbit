import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TimelineDataProvider } from "../data/context";
import SchedulerView from "./scheduler-view";

// The scheduler viewport measures width via useResizeObserver; happy-dom
// emits no size, so mock ResizeObserver to fire once at 800px (mirrors
// split-layout.test.tsx).
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
					{ target, contentRect: { width: 800, height: 400 } },
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

function renderScheduler() {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={qc}>
			<TimelineDataProvider>
				<SchedulerView />
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
}

describe("SchedulerView", () => {
	it("renders per-assignee group headers from seed data", async () => {
		renderScheduler();
		const headers = await screen.findAllByTestId("scheduler-group-header");
		expect(headers.length).toBeGreaterThan(0);
		// Seed data assigns tasks to named users.
		expect(screen.getByText("Maya Chen")).toBeInTheDocument();
	});

	it("drag on a bar's resize handle sets its height to the clamped max", async () => {
		renderScheduler();
		await screen.findAllByTestId("scheduler-group-header");

		// Task bars carry a resize handle; milestones do not.
		const handles = screen.getAllByTestId("scheduler-bar-resize");
		expect(handles.length).toBeGreaterThan(0);
		const handle = handles[0];
		const bar = handle.closest("[data-testid='scheduler-bar']") as HTMLElement;

		// Drag far downward: any startHeight + large dy clamps to MAX (96px → 480min).
		fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(window, { clientY: 400 });
		fireEvent.pointerUp(window, { clientY: 400 });

		expect(bar.style.height).toBe("96px");
	});
});
