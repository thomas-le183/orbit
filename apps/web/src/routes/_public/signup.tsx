import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/components/auth/signup-form";

export const Route = createFileRoute("/_public/signup")({
	component: SignupPage,
});

function SignupPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="bg-background-overlay-primary absolute inset-0 -z-10" />
			<div className="w-full max-w-sm">
				<SignupForm />
			</div>
		</div>
	);
}
