import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineDataProvider } from "../data/context";
import SchedulerView from "../scheduler-view";

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
});
