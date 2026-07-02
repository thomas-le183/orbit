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
import { Spinner } from "@orbit/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useCreateTask } from "@/hooks/use-tasks";

export function CreateTaskDialog({
	projectId,
	open,
	onOpenChange,
}: {
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const create = useCreateTask(projectId);

	const form = useForm({
		defaultValues: { name: "", startDate: "", endDate: "" },
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			await create.mutateAsync({
				name,
				...(value.startDate ? { startDate: value.startDate } : {}),
				...(value.endDate ? { endDate: value.endDate } : {}),
			});
			onOpenChange(false);
			form.reset();
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>Create task</DialogTitle>
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
										placeholder="Design review"
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>

					<div className="flex gap-3">
						<form.Field name="startDate">
							{(field) => (
								<Field className="flex-1">
									<FieldLabel htmlFor={field.name}>Start date</FieldLabel>
									<Input
										id={field.name}
										type="date"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</Field>
							)}
						</form.Field>
						<form.Field name="endDate">
							{(field) => (
								<Field className="flex-1">
									<FieldLabel htmlFor={field.name}>End date</FieldLabel>
									<Input
										id={field.name}
										type="date"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</Field>
							)}
						</form.Field>
					</div>

					<DialogFooter>
						<form.Subscribe
							selector={(state) => [state.isSubmitting]}
							children={([isSubmitting]) => (
								<>
									<Button
										type="button"
										variant="outline"
										onClick={() => onOpenChange(false)}
										disabled={isSubmitting}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting && <Spinner />}
										{isSubmitting ? "Creating…" : "Create task"}
									</Button>
								</>
							)}
						/>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
