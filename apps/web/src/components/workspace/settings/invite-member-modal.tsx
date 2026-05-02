import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@orbit/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@orbit/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useInviteMember } from "@/hooks/use-auth";

const ROLES = [
	{ value: "member", label: "Member", description: "Can view and participate" },
	{ value: "admin", label: "Admin", description: "Full access to settings" },
] as const;
type InviteRole = (typeof ROLES)[number]["value"];

export function InviteMemberModal({
	organizationId,
}: {
	organizationId: string;
}) {
	const [open, setOpen] = useState(false);
	const invite = useInviteMember();

	const form = useForm({
		defaultValues: { email: "", role: "member" as InviteRole },
		onSubmit: async ({ value }) => {
			await invite.mutateAsync({
				organizationId,
				email: value.email,
				role: value.role,
			});
			setOpen(false);
			form.reset();
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm">Invite members</Button>} />
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>Invite a member</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					<form.Field name="email">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>Email address</FieldLabel>
									<Input
										id={field.name}
										type="email"
										placeholder="colleague@example.com"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										required
									/>
									{isInvalid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="role">
						{(field) => (
							<Field>
								<FieldLabel>Role</FieldLabel>
								<Select
									value={field.state.value}
									onValueChange={(v) => field.handleChange(v as InviteRole)}
								>
									<SelectTrigger>
										<SelectValue>
											{(() => {
												const role = ROLES.find(r => r.value === field.state.value);
												return role ? (
													<>
														{role.label} —{" "}
														<span className="text-muted-foreground">{role.description}</span>
													</>
												) : null;
											})()}
										</SelectValue>
									</SelectTrigger>
									<SelectContent alignItemWithTrigger={false}>
										{ROLES.map((r) => (
											<SelectItem key={r.value} value={r.value}>
												{r.label} —{" "}
												<span className="text-muted-foreground!">
													{r.description}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>

					<DialogFooter>
						<DialogClose
							render={
								<Button type="button" variant="outline" size="sm">
									Cancel
								</Button>
							}
						/>
						<Button type="submit" size="sm" disabled={invite.isPending}>
							{invite.isPending ? "Sending…" : "Send invite"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
