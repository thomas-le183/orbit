import type { BillingInterval, SubscriptionPlan } from "@orbit/shared";
import { Button } from "@orbit/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
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
type InviteStep = "form" | "confirm";

function isPaidPlan(plan: SubscriptionPlan | null) {
	return plan === "basic" || plan === "business";
}

function formatSeatPrice(pricePerSeat: number | null) {
	if (pricePerSeat == null) return "Current per-seat rate";
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: pricePerSeat % 1 === 0 ? 0 : 2,
	}).format(pricePerSeat);
}

function formatInterval(billingInterval: BillingInterval | null) {
	if (billingInterval === "monthly") return "month";
	if (billingInterval === "yearly") return "year";
	return "billing period";
}

export function InviteMemberModal({
	organizationId,
	plan,
	pricePerSeat,
	billingInterval,
}: {
	organizationId: string;
	plan: SubscriptionPlan | null;
	pricePerSeat: number | null;
	billingInterval: BillingInterval | null;
}) {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<InviteStep>("form");
	const invite = useInviteMember();
	const paidPlan = isPaidPlan(plan);

	const form = useForm({
		defaultValues: { email: "", role: "member" as InviteRole },
		onSubmit: async ({ value }) => {
			if (paidPlan && step === "form") {
				setStep("confirm");
				return;
			}

			await invite.mutateAsync({
				organizationId,
				email: value.email,
				role: value.role,
			});
			closeAndReset();
		},
	});

	function closeAndReset() {
		setOpen(false);
		setStep("form");
		form.reset();
	}

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setOpen(true);
			return;
		}
		closeAndReset();
	}

	const email = form.state.values.email;
	const intervalLabel = formatInterval(billingInterval);
	const seatPriceLabel = formatSeatPrice(pricePerSeat);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button size="sm" disabled={plan == null}>
						Invite members
					</Button>
				}
			/>
			<DialogContent className="w-full max-w-md">
				<DialogHeader>
					<DialogTitle>
						{step === "confirm" ? "Add a seat?" : "Invite a member"}
					</DialogTitle>
					{step === "confirm" && (
						<DialogDescription>
							Inviting {email} will add 1 paid seat to your subscription.
						</DialogDescription>
					)}
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex flex-col gap-4"
				>
					{step === "form" ? (
						<>
							<form.Field name="email">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field>
											<FieldLabel htmlFor={field.name}>
												Email address
											</FieldLabel>
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
														const role = ROLES.find(
															(r) => r.value === field.state.value,
														);
														return role ? (
															<>
																{role.label} —{" "}
																<span className="text-muted-foreground">
																	{role.description}
																</span>
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
						</>
					) : (
						<>
							<div className="rounded-lg border bg-muted/30 p-4">
								<p className="font-medium">
									{seatPriceLabel} / seat / {intervalLabel}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									The prorated charge for this seat will be invoiced
									immediately.
								</p>
							</div>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setStep("form")}
									disabled={invite.isPending}
								>
									Back
								</Button>
								<Button type="submit" size="sm" disabled={invite.isPending}>
									{invite.isPending ? "Sending…" : "Confirm & invite"}
								</Button>
							</DialogFooter>
						</>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}
