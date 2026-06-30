import { SidebarProvider } from "@orbit/ui/components/sidebar";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjects } from "@/hooks/use-projects";
import { ProjectsNavSection } from "./projects-nav-section";

function renderWithSidebar(ui: React.ReactElement) {
	return render(<SidebarProvider>{ui}</SidebarProvider>);
}

const navigate = vi.fn();
vi.mock("@/hooks/use-projects", () => ({ useProjects: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	useMatchRoute: () => () => false,
}));
// Render the dialog as a no-op so this test stays focused on the section.
vi.mock("./create-project-dialog", () => ({
	CreateProjectDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-project-dialog-open</div> : null,
}));

const useProjectsMock = useProjects as unknown as ReturnType<typeof vi.fn>;

describe("ProjectsNavSection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows the empty state when there are no projects", () => {
		useProjectsMock.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		});
		renderWithSidebar(<ProjectsNavSection orgSlug="acme" />);
		expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
	});

	it("lists projects and navigates on click", () => {
		useProjectsMock.mockReturnValue({
			data: [{ id: "p1", name: "Alpha", color: null }],
			isLoading: false,
			isError: false,
		});
		renderWithSidebar(<ProjectsNavSection orgSlug="acme" />);
		fireEvent.click(screen.getByText("Alpha"));
		expect(navigate).toHaveBeenCalledWith({
			to: "/$orgSlug/projects/$projectId",
			params: { orgSlug: "acme", projectId: "p1" },
		});
	});

	it("opens the create dialog from the new-project action", () => {
		useProjectsMock.mockReturnValue({
			data: [],
			isLoading: false,
			isError: false,
		});
		renderWithSidebar(<ProjectsNavSection orgSlug="acme" />);
		fireEvent.click(screen.getByRole("button", { name: /new project/i }));
		expect(screen.getByText("create-project-dialog-open")).toBeInTheDocument();
	});
});
