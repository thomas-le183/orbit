import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TimelineDataProvider } from "../data/context";
import SplitLayout from "./split-layout";
import TimelineTable, { TimelineTableHeader } from "./timeline-table";

// Right region measures width via useResizeObserver; happy-dom emits no size,
// so mock ResizeObserver to fire once at 800px.
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

function renderShell() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<TimelineDataProvider>
				<SplitLayout
					tableHeader={<TimelineTableHeader />}
					table={<TimelineTable />}
				/>
			</TimelineDataProvider>
		</QueryClientProvider>,
	);
}

describe("SplitLayout", () => {
	it("renders the date axis, the table column, the items layer, and the divider", () => {
		const { container } = renderShell();
		expect(
			container.querySelector("[data-testid='timeline-header-top']"),
		).not.toBeNull();
		expect(
			container.querySelectorAll("[data-testid='timeline-table-row']").length,
		).toBeGreaterThan(0);
		expect(
			container.querySelector("[data-testid='timeline-items-content']"),
		).not.toBeNull();
		expect(
			container.querySelector("[data-testid='timeline-split-divider']"),
		).not.toBeNull();
	});

	it("widens the table column when the divider is dragged right", () => {
		const { container } = renderShell();
		const divider = container.querySelector<HTMLElement>(
			"[data-testid='timeline-split-divider']",
		);
		const col = container.querySelector<HTMLElement>(
			"[data-testid='timeline-table-column']",
		);
		if (!divider || !col) throw new Error("missing divider/column");
		const before = Number.parseFloat(col.style.width);
		fireEvent.pointerDown(divider, { clientX: 320 });
		fireEvent.pointerMove(window, { clientX: 400 });
		fireEvent.pointerUp(window);
		const after = Number.parseFloat(col.style.width);
		expect(after).toBeGreaterThan(before);
	});
});
