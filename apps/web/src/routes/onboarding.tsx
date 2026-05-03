import { Button } from "@orbit/ui/components/button";
import { Field, FieldError, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
	loadAuthState,
	resolveAuthenticatedLanding,
	useUpdateUser,
} from "@/hooks/use-auth";

export const Route = createFileRoute("/onboarding")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);

		if (!state.user) {
			throw redirect({ to: "/login" });
		}

		if (state.user.name) {
			const landing = resolveAuthenticatedLanding(state);
			if (landing) throw redirect(landing);
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	const updateUser = useUpdateUser();

	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value }) => {
			await updateUser.mutateAsync({ name: value.name.trim() });
			router.navigate({ to: "/create-workspace" });
		},
	});

	return (
		<div className="flex min-h-svh items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">What is your name?</h1>
					<p className="text-sm text-muted-foreground">
						This is how you will appear to your teammates.
					</p>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field
						name="name"
						validators={{
							onChange: ({ value }) =>
								!value.trim() ? "Name is required" : undefined,
						}}
					>
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field className="space-y-1">
									<FieldLabel htmlFor={field.name}>Full name</FieldLabel>
									<Input
										id={field.name}
										placeholder="Your full name"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										autoFocus
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								className="w-full"
								disabled={!canSubmit || isSubmitting}
							>
								{isSubmitting ? "Saving..." : "Continue"}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</div>
		</div>
	);
}
