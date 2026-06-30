import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTaskDialog } from "./create-task-dialog";

const mutateAsync = vi.fn();
vi.mock("@/hooks/use-tasks", () => ({
	useCreateTask: () => ({ mutateAsync, isPending: false }),
}));

describe("CreateTaskDialog", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue({ id: "t1", name: "Alpha" });
	});

	it("blocks submit and shows an error when the name is empty", async () => {
		render(<CreateTaskDialog projectId="p1" open onOpenChange={() => {}} />);
		fireEvent.blur(screen.getByLabelText(/name/i));
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		await waitFor(() =>
			expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
		);
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("submits name only (no dates) and closes on success", async () => {
		const onOpenChange = vi.fn();
		render(
			<CreateTaskDialog projectId="p1" open onOpenChange={onOpenChange} />,
		);
		fireEvent.change(screen.getByLabelText(/name/i), {
			target: { value: "Beta" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({ name: "Beta" }),
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("includes dates when provided", async () => {
		render(<CreateTaskDialog projectId="p1" open onOpenChange={() => {}} />);
		fireEvent.change(screen.getByLabelText(/name/i), {
			target: { value: "Gamma" },
		});
		fireEvent.change(screen.getByLabelText(/start/i), {
			target: { value: "2026-07-01" },
		});
		fireEvent.change(screen.getByLabelText(/end/i), {
			target: { value: "2026-07-05" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create task/i }));
		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({
				name: "Gamma",
				startDate: "2026-07-01",
				endDate: "2026-07-05",
			}),
		);
	});
});
