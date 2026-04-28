import { Button } from "@orbit/ui/components/button";
import { Input } from "@orbit/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
	loadAuthState,
	useCreateOrganization,
	useSetActiveOrganization,
} from "@/hooks/use-auth";

export const Route = createFileRoute("/create-workspace")({
	beforeLoad: async ({ context }) => {
		const state = await loadAuthState(context.queryClient);

		if (!state.user) {
			throw redirect({ to: "/login" });
		}

		if (!state.user.name) {
			throw redirect({ to: "/onboarding" });
		}
	},
	component: RouteComponent,
});

function toSlug(name: string) {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function RouteComponent() {
	const router = useRouter();
	const createOrg = useCreateOrganization();
	const setActive = useSetActiveOrganization();

	const form = useForm({
		defaultValues: { name: "", slug: "" },
		onSubmit: async ({ value }) => {
			const org = await createOrg.mutateAsync({
				name: value.name.trim(),
				slug: value.slug.trim(),
			});
			if (org) {
				await setActive.mutateAsync(org.id);
				router.navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
			}
		},
	});

	return (
		<div className="flex min-h-svh items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">Create your workspace</h1>
					<p className="text-sm text-muted-foreground">
						A workspace is where your team communicates and collaborates.
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
								!value.trim() ? "Workspace name is required" : undefined,
						}}
					>
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className="text-sm font-medium">
									Workspace name
								</label>
								<Input
									id={field.name}
									placeholder="Acme Inc."
									value={field.state.value}
									onBlur={field.handleBlur}
									autoFocus
									onChange={(e) => {
										field.handleChange(e.target.value);
										form.setFieldValue("slug", toSlug(e.target.value));
									}}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-xs text-destructive">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Field
						name="slug"
						validators={{
							onChange: ({ value }) => {
								if (!value.trim()) return "URL slug is required";
								if (!/^[a-z0-9-]+$/.test(value))
									return "Only lowercase letters, numbers, and hyphens";
								return undefined;
							},
						}}
					>
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className="text-sm font-medium">
									URL slug
								</label>
								<div className="flex">
									<span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-xs text-muted-foreground">
										orbit.app/
									</span>
									<Input
										id={field.name}
										className="rounded-l-none"
										placeholder="acme-inc"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</div>
								{field.state.meta.errors.length > 0 && (
									<p className="text-xs text-destructive">
										{field.state.meta.errors[0]}
									</p>
								)}
							</div>
						)}
					</form.Field>

					<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								className="w-full"
								disabled={!canSubmit || isSubmitting}
							>
								{isSubmitting ? "Creating..." : "Create workspace"}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</div>
		</div>
	);
}
