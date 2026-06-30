import { Button } from "@orbit/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@orbit/ui/components/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
} from "@orbit/ui/components/sidebar";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { type MouseEventHandler, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { useProjects } from "@/hooks/use-projects";
import { CreateTaskDialog } from "../timeline/create-task-dialog";
import { CreateProjectDialog } from "./create-project-dialog";

type Project = { id: string; name: string; color: string | null };

function ProjectNavItem({
	project,
	orgSlug,
}: {
	project: Project;
	orgSlug: string;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={project.name}
				isActive={
					!!matchRoute({
						to: "/$orgSlug/projects/$projectId",
						params: { orgSlug, projectId: project.id },
					})
				}
				onClick={() =>
					navigate({
						to: "/$orgSlug/projects/$projectId",
						params: { orgSlug, projectId: project.id },
					})
				}
				className="group/item"
			>
				<span
					className="size-2 shrink-0 rounded-full"
					style={{
						backgroundColor: project.color ?? "var(--color-muted-foreground)",
					}}
				/>
				<span className="truncate">{project.name}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={`New task in ${project.name}`}
					className="ml-auto hidden group-hover/item:flex"
					onClick={(e) => {
						e.stopPropagation();
						setDialogOpen(true);
					}}
				>
					<PlusIcon />
				</Button>
			</SidebarMenuButton>
			<CreateTaskDialog
				projectId={project.id}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</SidebarMenuItem>
	);
}

export function ProjectsNavSection({ orgSlug }: { orgSlug: string }) {
	const { data: projects, isLoading, isError } = useProjects(orgSlug);
	const [open, setOpen] = useLocalStorage("sidebar:section:Projects", true);
	const [dialogOpen, setDialogOpen] = useState(false);

	const openDialog: MouseEventHandler = (e) => {
		e.stopPropagation();
		setDialogOpen(true);
	};

	return (
		<SidebarGroup>
			<Collapsible
				open={open}
				onOpenChange={setOpen}
				className="group/collapsible"
			>
				<CollapsibleTrigger
					render={
						<SidebarMenuButton
							tooltip="Projects"
							className="flex-1 group-data-[collapsible=icon]:hidden justify-between group/item"
						/>
					}
				>
					<SidebarGroupLabel>Projects</SidebarGroupLabel>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="New project"
							className="hidden group-hover/item:flex"
							onClick={openDialog}
						>
							<PlusIcon />
						</Button>
						<ChevronRightIcon className="ml-auto size-3.5 transition-transform ease-in-out group-data-open/collapsible:rotate-90" />
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent className="mt-0.5 overflow-hidden">
					<SidebarMenu>
						{isLoading &&
							[0, 1, 2].map((i) => (
								<SidebarMenuItem key={i}>
									<SidebarMenuSkeleton showIcon />
								</SidebarMenuItem>
							))}
						{isError && (
							<div className="px-2 py-1.5 text-xs text-muted-foreground">
								Couldn't load projects
							</div>
						)}
						{!isLoading && !isError && projects?.length === 0 && (
							<div className="px-2 py-1.5 text-xs text-muted-foreground">
								No projects yet
							</div>
						)}
						{projects?.map((project) => (
							<ProjectNavItem
								key={project.id}
								project={project}
								orgSlug={orgSlug}
							/>
						))}
					</SidebarMenu>
				</CollapsibleContent>
			</Collapsible>
			<CreateProjectDialog
				orgSlug={orgSlug}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</SidebarGroup>
	);
}
