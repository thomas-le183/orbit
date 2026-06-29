import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateProjectDialog } from "./create-project-dialog";

const mutateAsync = vi.fn();
vi.mock("@/hooks/use-projects", () => ({
	useCreateProject: () => ({ mutateAsync, isPending: false }),
}));

describe("CreateProjectDialog", () => {
	beforeEach(() => {
		mutateAsync.mockReset();
		mutateAsync.mockResolvedValue({ id: "p1", name: "Alpha" });
	});

	it("does not submit when the name is empty", async () => {
		render(<CreateProjectDialog orgSlug="acme" open onOpenChange={() => {}} />);
		// Blur the name input first so the onChange validator has run
		fireEvent.blur(screen.getByLabelText(/name/i));
		fireEvent.click(screen.getByRole("button", { name: /create project/i }));
		await waitFor(() =>
			expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
		);
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("submits a valid name and closes on success", async () => {
		const onOpenChange = vi.fn();
		render(
			<CreateProjectDialog orgSlug="acme" open onOpenChange={onOpenChange} />,
		);
		fireEvent.change(screen.getByLabelText(/name/i), {
			target: { value: "Beta" },
		});
		fireEvent.click(screen.getByRole("button", { name: /create project/i }));
		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({ name: "Beta" }),
		);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
