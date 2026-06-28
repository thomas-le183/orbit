import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
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
		// zoom control: a dropdown trigger button showing the current view
		expect(
			container.querySelector("[data-slot='dropdown-menu-trigger']"),
		).not.toBeNull();
	});

	it("pans the view when the arrow buttons are clicked", () => {
		const { container } = renderWithClient(<TimelineContainer />);
		const nowLineLeft = () =>
			(
				container.querySelector(
					"[data-testid='timeline-now-line']",
				) as HTMLElement
			).style.left;

		const before = nowLineLeft();
		fireEvent.click(
			container.querySelector(
				"[data-testid='timeline-pan-later']",
			) as HTMLElement,
		);
		// panning later moves the offset forward, so today (the now-line) shifts left
		expect(nowLineLeft()).not.toBe(before);
	});

	it("pans the view with the left/right arrow keys", () => {
		const { container } = renderWithClient(<TimelineContainer />);
		const nowLineLeft = () =>
			(
				container.querySelector(
					"[data-testid='timeline-now-line']",
				) as HTMLElement
			).style.left;

		const before = nowLineLeft();
		fireEvent.keyDown(window, { key: "ArrowRight" });
		const afterRight = nowLineLeft();
		expect(afterRight).not.toBe(before);

		// ArrowLeft pans back the other way
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		expect(nowLineLeft()).not.toBe(afterRight);
	});

	it("ignores arrow keys while typing in an input", () => {
		const { container } = renderWithClient(<TimelineContainer />);
		const nowLineLeft = () =>
			(
				container.querySelector(
					"[data-testid='timeline-now-line']",
				) as HTMLElement
			).style.left;

		const input = document.createElement("input");
		document.body.appendChild(input);
		const before = nowLineLeft();
		fireEvent.keyDown(input, { key: "ArrowRight" });
		expect(nowLineLeft()).toBe(before);
		input.remove();
	});
});
