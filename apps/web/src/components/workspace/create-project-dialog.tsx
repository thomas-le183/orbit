import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@orbit/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { Textarea } from "@orbit/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useCreateProject } from "@/hooks/use-projects";

export function CreateProjectDialog({
	orgSlug,
	open,
	onOpenChange,
}: {
	orgSlug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const create = useCreateProject(orgSlug);

	const form = useForm({
		defaultValues: { name: "", description: "" },
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			const description = value.description.trim();
			await create.mutateAsync(description ? { name, description } : { name });
			onOpenChange(false);
			form.reset();
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>Create project</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					<form.Field
						name="name"
						validators={{
							onChange: ({ value }: { value: string }) =>
								value.trim().length === 0 ? "Name is required" : undefined,
							onBlur: ({ value }: { value: string }) =>
								value.trim().length === 0 ? "Name is required" : undefined,
						}}
					>
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Name</FieldLabel>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="Marketing site revamp"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="description">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Description (optional)
								</FieldLabel>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={3}
								/>
							</Field>
						)}
					</form.Field>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={create.isPending}>
							Create project
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
