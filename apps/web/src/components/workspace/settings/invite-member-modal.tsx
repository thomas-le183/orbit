import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
} from "@orbit/ui/components/dialog";
import { Field, FieldLabel } from "@orbit/ui/components/field";
import { Input } from "@orbit/ui/components/input";
import { cn } from "@orbit/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useInviteMember } from "@/hooks/use-auth";

const ROLES = ["member", "admin"] as const;
type InviteRole = (typeof ROLES)[number];

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
			<DialogContent className="w-full max-w-md p-6" showCloseButton={false}>
				<h2 className="mb-4 text-base font-semibold">Invite a member</h2>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					<form.Field name="email">
						{(field) => (
							<Field>
								<FieldLabel>Email address</FieldLabel>
								<Input
									type="email"
									placeholder="colleague@example.com"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									required
								/>
							</Field>
						)}
					</form.Field>

					<form.Field name="role">
						{(field) => (
							<Field>
								<FieldLabel>Role</FieldLabel>
								<div className="flex gap-2">
									{ROLES.map((r) => (
										<button
											key={r}
											type="button"
											onClick={() => field.handleChange(r)}
											className={cn(
												"rounded-md border px-3 py-1.5 text-sm capitalize transition-colors",
												field.state.value === r
													? "border-primary bg-primary/10 text-primary"
													: "border-border text-muted-foreground hover:border-primary/50",
											)}
										>
											{r}
										</button>
									))}
								</div>
							</Field>
						)}
					</form.Field>

					<div className="flex justify-end gap-2 pt-2">
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
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
