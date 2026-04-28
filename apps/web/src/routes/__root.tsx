import { Toaster } from "@orbit/ui/components/sonner";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "@/components/auth/theme-provider";
import { queryClient } from "@/lib/query-client";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		component: RootComponent,
		errorComponent: ({ error }) => {
			<div>{error.message}</div>;
		},
	},
);

function RootComponent() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				<Outlet />
				<Toaster />
				{import.meta.env.DEV && (
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "TanStack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				)}
			</ThemeProvider>
		</QueryClientProvider>
	);
}
