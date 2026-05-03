import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@orbit/ui/components/avatar";
import { Button } from "@orbit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@orbit/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@orbit/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { Spinner } from "@orbit/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
	loadAuthState,
	useCreateOrganization,
	useOrganizations,
	useSession,
	useSetActiveOrganization,
	useSignOut,
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
	const { data: organizations = [] } = useOrganizations();
	const { data: session } = useSession();
	const signOut = useSignOut();

	const user = session?.user;
	const initials = user?.name
		?.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const form = useForm({
		defaultValues: { name: "", slug: "" },
		onSubmit: async ({ value }) => {
			try {
				const org = await createOrg.mutateAsync({
					name: value.name.trim(),
					slug: value.slug.trim(),
				});
				if (org) {
					await setActive.mutateAsync(org.id);
					router.navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
				}
			} catch (err: unknown) {
				toast.error(getErrorMessage(err, "Failed to create workspace. Please try again."));
			}
		},
	});

	return (
		<div className="relative flex min-h-svh items-center justify-center p-4">
			<div className="absolute left-4 right-4 top-4 flex items-center justify-between">
				{organizations.length > 0 ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-muted-foreground"
						onClick={() => router.history.back()}
					>
						<ArrowLeft className="size-4" />
						Back
					</Button>
				) : (
					<div />
				)}

				{user && (
					<DropdownMenu>
						<DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
							<span>{user.email}</span>
							<Avatar className="size-7">
								<AvatarImage src={user.image ?? undefined} />
								<AvatarFallback className="text-xs">{initials}</AvatarFallback>
							</Avatar>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuGroup>
								<DropdownMenuLabel className="font-normal">
									<p className="font-medium">{user.name}</p>
									<p className="text-xs text-muted-foreground">{user.email}</p>
								</DropdownMenuLabel>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() =>
									signOut.mutate(undefined, {
										onSuccess: () => router.navigate({ to: "/login" }),
									})
								}
								className="text-destructive focus:text-destructive"
							>
								<LogOut className="size-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Create your workspace</CardTitle>
					<CardDescription>
						A workspace is where your team communicates and collaborates.
					</CardDescription>
				</CardHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<CardContent className="space-y-4">
						<form.Field
							name="name"
							validators={{
								onChange: ({ value }) =>
									!value.trim() ? "Workspace name is required" : undefined,
							}}
						>
							{(field) => (
								<Field className="space-y-1">
									<FieldLabel htmlFor={field.name}>Workspace name</FieldLabel>
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
								</Field>
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
								<Field className="space-y-1">
									<FieldLabel htmlFor={field.name}>URL slug</FieldLabel>
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
								</Field>
							)}
						</form.Field>
					</CardContent>

					<CardFooter className="mt-4">
						<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button
									type="submit"
									className="w-full"
									disabled={!canSubmit || isSubmitting}
								>
									{isSubmitting ? (
										<>
											<Spinner data-icon="inline-start" /> Creating...
										</>
									) : (
										"Create workspace"
									)}
								</Button>
							)}
						</form.Subscribe>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
