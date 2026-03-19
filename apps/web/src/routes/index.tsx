import { Button } from "@take-me/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<main className="page-wrap px-4 pb-8 pt-14">
			<Button>asd</Button>
		</main>
	);
}
