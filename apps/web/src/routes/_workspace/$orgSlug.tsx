import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@orbit/ui/components/resizable";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppNav } from "@/components/workspace/app-nav";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { TopNav } from "@/components/workspace/top-nav";

export const Route = createFileRoute("/_workspace/$orgSlug")({
	component: OrgLayout,
});

function OrgLayout() {
	const { orgSlug } = Route.useParams();
	return (
		<div className="flex h-screen flex-col">
			<TopNav orgSlug={orgSlug} />
			<div className="flex flex-1 gap-2 overflow-hidden p-2">
				<AppNav orgSlug={orgSlug} />
				<ResizablePanelGroup orientation="horizontal">
					<ResizablePanel
						id="sidebar"
						defaultSize="15%"
						minSize="180px"
						maxSize="280px"
						collapsible
						collapsedSize={0}
						groupResizeBehavior="preserve-pixel-size"
					>
						<AppSidebar orgSlug={orgSlug} />
					</ResizablePanel>

					<ResizableHandle />

					<ResizablePanel id="main" defaultSize="85%">
						<main className="h-full overflow-auto p-6">
							<Outlet />
						</main>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	);
}
