import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public")({
	beforeLoad: ({ context }) => {
		if (context.session) {
			console.log(context)
			throw redirect({ to: "/" });
		}
	},
	component: () => <Outlet />,
});
