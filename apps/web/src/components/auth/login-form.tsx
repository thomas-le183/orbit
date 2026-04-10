import { Button } from "@orbit/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { cn } from "@orbit/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { GalleryVerticalEndIcon } from "lucide-react";
import { useSignIn } from "@/hooks/use-auth";

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const navigate = useNavigate();
	const signIn = useSignIn();

	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			await signIn.mutateAsync({
				email: value.email,
				password: value.password,
			});
			await navigate({ to: "/" });
		},
	});

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex size-8 items-center justify-center rounded-md">
							<GalleryVerticalEndIcon className="size-6" />
						</div>
						<h1 className="text-xl font-bold">Welcome back</h1>
						<FieldDescription>
							Don&apos;t have an account?{" "}
							<Link to="/signup" className="underline underline-offset-4">
								Sign up
							</Link>
						</FieldDescription>
					</div>

					<form.Field
						name="email"
						children={(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Email</FieldLabel>
								<Input
									id={field.name}
									type="email"
									placeholder="m@example.com"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									required
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError>{String(field.state.meta.errors[0])}</FieldError>
								)}
							</Field>
						)}
					/>

					<form.Field
						name="password"
						children={(field) => (
							<Field>
								<div className="flex items-center justify-between">
									<FieldLabel htmlFor={field.name}>Password</FieldLabel>
									<Link
										to="/forgot-password"
										className="text-sm underline underline-offset-4"
									>
										Forgot password?
									</Link>
								</div>
								<Input
									id={field.name}
									type="password"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									required
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError>{String(field.state.meta.errors[0])}</FieldError>
								)}
							</Field>
						)}
					/>

					{signIn.error && (
						<FieldError>{signIn.error.message}</FieldError>
					)}

					<form.Subscribe
						selector={(state) => state.isSubmitting}
						children={(isSubmitting) => (
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Signing in…" : "Sign in"}
								</Button>
							</Field>
						)}
					/>

					<FieldSeparator>Or</FieldSeparator>

					<Field className="grid gap-4 sm:grid-cols-2">
						<Button variant="outline" type="button">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
								<path
									d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
									fill="currentColor"
								/>
							</svg>
							Continue with Apple
						</Button>
						<Button variant="outline" type="button">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
								<path
									d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
									fill="currentColor"
								/>
							</svg>
							Continue with Google
						</Button>
					</Field>
				</FieldGroup>
			</form>
			<FieldDescription className="px-6 text-center">
				By clicking continue, you agree to our{" "}
				<Link to="/" className="underline underline-offset-4">
					Terms of Service
				</Link>{" "}
				and{" "}
				<Link to="/" className="underline underline-offset-4">
					Privacy Policy
				</Link>
				.
			</FieldDescription>
		</div>
	);
}
