import { ThemeProvider } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { getOrgSlug } from "@/lib/subdomain";
import type { RouterContext } from "@/router";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async () => {
		const { data: session } = await authClient.getSession();
		const orgSlug = getOrgSlug();
		return { session, orgSlug };
	},
	component: RootComponent,
});

function RootComponent() {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<Outlet />
			<TanStackDevtools
				config={{ position: "bottom-right" }}
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
