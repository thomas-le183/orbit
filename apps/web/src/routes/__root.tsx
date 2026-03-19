import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ModeToggle } from "@/components/mode-toggle";
import { ThemeProvider } from "@/components/theme-provider";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<header className="fixed top-0 right-0 p-3 z-50">
				<ModeToggle />
			</header>
			<Outlet />
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</ThemeProvider>
	);
}
